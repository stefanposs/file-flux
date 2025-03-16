package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/rs/cors"

	"github.com/stefanposs/file-flux/backend/internal/auth"
	"github.com/stefanposs/file-flux/backend/internal/database"
	"github.com/stefanposs/file-flux/backend/internal/handlers"
	"github.com/stefanposs/file-flux/backend/internal/payment"
	"github.com/stefanposs/file-flux/backend/internal/services"
	"github.com/stefanposs/file-flux/backend/pkg/config"
)

func main() {
	// Load environment variables from .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Load configuration
	cfg := config.LoadConfig()

	// Setup database connection
	db, err := database.NewPostgresDB(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Auth0 service
	authConfig := auth.Auth0Config{
		Domain:       os.Getenv("AUTH0_DOMAIN"),
		ClientID:     os.Getenv("AUTH0_CLIENT_ID"),
		ClientSecret: os.Getenv("AUTH0_CLIENT_SECRET"),
		Audience:     os.Getenv("AUTH0_AUDIENCE"),
		Issuer:       "https://" + os.Getenv("AUTH0_DOMAIN") + "/",
	}

	authService, err := auth.NewAuthService(authConfig)
	if err != nil {
		log.Fatalf("Failed to initialize auth service: %v", err)
	}

	// Initialize Stripe payment service
	stripeConfig := payment.StripeConfig{
		SecretKey:     os.Getenv("STRIPE_SECRET_KEY"),
		WebhookSecret: os.Getenv("STRIPE_WEBHOOK_SECRET"),
		SuccessURL:    os.Getenv("STRIPE_SUCCESS_URL"),
		CancelURL:     os.Getenv("STRIPE_CANCEL_URL"),
		Plans: map[payment.Plan]payment.PlanConfig{
			payment.Free: {
				Name:        "Free",
				Description: "Free plan with basic features",
				PriceID:     os.Getenv("STRIPE_FREE_PLAN_PRICE_ID"),
				Features:    []string{"2 active jobs", "1 agent", "Basic support"},
			},
			payment.Hobby: {
				Name:        "Hobby",
				Description: "Hobby plan for small projects",
				PriceID:     os.Getenv("STRIPE_HOBBY_PLAN_PRICE_ID"),
				Features:    []string{"10 active jobs", "5 agents", "Email support"},
			},
			payment.Business: {
				Name:        "Business",
				Description: "Business plan for professional use",
				PriceID:     os.Getenv("STRIPE_BUSINESS_PLAN_PRICE_ID"),
				Features:    []string{"Unlimited jobs", "Unlimited agents", "Priority support"},
			},
		},
	}

	paymentService := payment.NewPaymentService(stripeConfig)

	// Initialize core services
	fileTransferService := services.NewFileTransferService(cfg)
	userService := services.NewUserService(db)
	jobService := services.NewJobService(db)
	agentService := services.NewAgentService(db)

	// Initialize handlers
	fileTransferHandler := handlers.NewFileTransferHandler(fileTransferService)
	userHandler := handlers.NewUserHandler(userService)
	jobHandler := handlers.NewJobHandler(jobService)
	agentHandler := handlers.NewAgentHandler(agentService)
	paymentHandler := handlers.NewPaymentHandler(paymentService)

	// Setup router and middlewares
	r := mux.NewRouter()

	// CORS middleware
	corsMiddleware := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"}, // In production, restrict to your domain
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	})

	// Public routes
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}).Methods("GET")

	r.HandleFunc("/api/v1/webhook/stripe", paymentHandler.HandleWebhook).Methods("POST")

	// File transfer routes (require job token)
	r.HandleFunc("/api/v1/poll/upload", fileTransferHandler.HandleLongPollingUpload).Methods("POST")
	r.HandleFunc("/api/v1/poll/download", fileTransferHandler.HandleLongPollingDownload).Methods("GET")

	// Routes that require authentication
	apiRouter := r.PathPrefix("/api/v1").Subrouter()
	apiRouter.Use(authService.AuthMiddleware)

	// User routes
	apiRouter.HandleFunc("/users/me", userHandler.GetCurrentUser).Methods("GET")
	apiRouter.HandleFunc("/users/{id}", userHandler.GetUser).Methods("GET")
	apiRouter.HandleFunc("/users/{id}", userHandler.UpdateUser).Methods("PUT")

	// Job routes
	apiRouter.HandleFunc("/jobs", jobHandler.CreateJob).Methods("POST")
	apiRouter.HandleFunc("/jobs", jobHandler.ListJobs).Methods("GET")
	apiRouter.HandleFunc("/jobs/{id}", jobHandler.GetJob).Methods("GET")
	apiRouter.HandleFunc("/jobs/{id}", jobHandler.UpdateJob).Methods("PUT")
	apiRouter.HandleFunc("/jobs/{id}", jobHandler.DeleteJob).Methods("DELETE")
	apiRouter.HandleFunc("/jobs/{id}/events", jobHandler.GetJobEvents).Methods("GET")

	// Agent routes
	apiRouter.HandleFunc("/agents", agentHandler.ListAgents).Methods("GET")
	apiRouter.HandleFunc("/agents/{id}", agentHandler.GetAgent).Methods("GET")
	apiRouter.HandleFunc("/agents/{id}", agentHandler.UpdateAgent).Methods("PUT")
	apiRouter.HandleFunc("/agents/{id}", agentHandler.DeleteAgent).Methods("DELETE")

	// Payment routes
	apiRouter.HandleFunc("/payment/checkout", paymentHandler.CreateCheckoutSession).Methods("POST")
	apiRouter.HandleFunc("/payment/subscription", paymentHandler.GetSubscription).Methods("GET")
	apiRouter.HandleFunc("/payment/subscription/cancel", paymentHandler.CancelSubscription).Methods("POST")

	// Routes that require admin role
	adminRouter := apiRouter.PathPrefix("/admin").Subrouter()
	adminRouter.Use(authService.CheckScope("admin"))

	// Admin routes
	adminRouter.HandleFunc("/users", userHandler.ListUsers).Methods("GET")
	adminRouter.HandleFunc("/organizations", userHandler.ListOrganizations).Methods("GET")

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = cfg.Port
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: corsMiddleware.Handler(r),
	}

	log.Printf("Starting server on port %s", port)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("Could not start server: %v", err)
	}
}
