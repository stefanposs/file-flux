package api

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/stefanposs/file-flux/backend/pkg/config"
	"github.com/stefanposs/file-flux/backend/pkg/domain/agents"
	"github.com/stefanposs/file-flux/backend/pkg/domain/jobs"
	"github.com/stefanposs/file-flux/backend/pkg/infrastructure/auth"
	"github.com/stefanposs/file-flux/backend/pkg/infrastructure/db"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Server repräsentiert den HTTP-Server der Anwendung
type Server struct {
	router *gin.Engine
	server *http.Server
	logger *zap.Logger
	config *config.Config
	db     *gorm.DB
}

// NewServer erstellt eine neue Server-Instanz
func NewServer(cfg *config.Config, logger *zap.Logger, db *gorm.DB) *Server {
	// Im Produktionsmodus Gin im Release-Modus ausführen
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery())

	// Logger Middleware
	router.Use(func(c *gin.Context) {
		path := c.Request.URL.Path
		method := c.Request.Method

		c.Next()

		statusCode := c.Writer.Status()
		logger.Info("request",
			zap.String("path", path),
			zap.String("method", method),
			zap.Int("status", statusCode),
		)
	})

	server := &Server{
		router: router,
		logger: logger,
		config: cfg,
		db:     db,
	}

	server.setupRoutes()

	server.server = &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: router,
	}

	return server
}

// setupRoutes konfiguriert alle API-Routen
func (s *Server) setupRoutes() {
	// Repositories
	jobRepo := jobs.NewRepository(s.db)
	agentRepo := agents.NewRepository(s.db)

	// Services
	jobService := jobs.NewService(jobRepo, s.logger)
	agentService := agents.NewService(agentRepo, s.logger)

	// Auth0 Middleware
	authMiddleware := auth.NewAuth0Middleware(s.config.Auth0Domain, s.config.Auth0Audience)

	// API-Versioning mit v1-Gruppe
	v1 := s.router.Group("/api/v1")

	// Health Check (öffentlich)
	v1.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "OK"})
	})

	// Geschützte Routen
	protected := v1.Group("/")
	protected.Use(authMiddleware.ValidateToken())

	// Jobs-Endpunkte
	jobs := protected.Group("/jobs")
	{
		handler := NewJobHandler(jobService)
		jobs.GET("/", handler.ListJobs)
		jobs.GET("/:id", handler.GetJob)
		jobs.POST("/", handler.CreateJob)
		jobs.PUT("/:id", handler.UpdateJob)
		jobs.DELETE("/:id", handler.DeleteJob)
	}

	// Agents-Endpunkte
	agents := protected.Group("/agents")
	{
		handler := NewAgentHandler(agentService)
		agents.GET("/", handler.ListAgents)
		agents.GET("/:id", handler.GetAgent)
		agents.POST("/register", handler.RegisterAgent)
	}

	// Agent-Kommunikation (teilweise ungeschützt für Agent-Zugriff)
	agentComm := v1.Group("/agent-comm")
	{
		handler := NewAgentCommunicationHandler(agentService, jobService)
		agentComm.POST("/heartbeat", handler.Heartbeat)
		agentComm.POST("/status", handler.UpdateStatus)
		agentComm.GET("/poll", handler.PollCommands)
	}
}

// Start startet den HTTP-Server
func (s *Server) Start() error {
	return s.server.ListenAndServe()
}

// Shutdown führt ein graceful Shutdown des Servers durch
func (s *Server) Shutdown(ctx context.Context) error {
	return s.server.Shutdown(ctx)
}
