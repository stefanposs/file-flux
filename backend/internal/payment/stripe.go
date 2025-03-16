package payment

import (
	"encoding/json"
	"errors"
	"io/ioutil"
	"log"
	"net/http"

	"github.com/stripe/stripe-go/v74"
	"github.com/stripe/stripe-go/v74/checkout/session"
	"github.com/stripe/stripe-go/v74/subscription"
	"github.com/stripe/stripe-go/v74/webhook"
)

type Plan string

const (
	Free     Plan = "free"
	Hobby    Plan = "hobby"
	Business Plan = "business"
)

// PlanConfig holds configuration for subscription plans
type PlanConfig struct {
	Name        string
	Description string
	PriceID     string // Stripe Price ID
	Features    []string
}

type StripeConfig struct {
	SecretKey     string
	WebhookSecret string
	SuccessURL    string
	CancelURL     string
	Plans         map[Plan]PlanConfig
}

type PaymentService struct {
	config StripeConfig
}

func NewPaymentService(config StripeConfig) *PaymentService {
	// Initialize Stripe
	stripe.Key = config.SecretKey

	return &PaymentService{
		config: config,
	}
}

// CreateCheckoutSession creates a new Stripe checkout session for subscription
func (s *PaymentService) CreateCheckoutSession(userID, email string, plan Plan) (string, error) {
	planConfig, ok := s.config.Plans[plan]
	if !ok {
		return "", errors.New("invalid plan selected")
	}

	params := &stripe.CheckoutSessionParams{
		CustomerEmail:     stripe.String(email),
		ClientReferenceID: stripe.String(userID),
		Mode:              stripe.String("subscription"),
		SuccessURL:        stripe.String(s.config.SuccessURL),
		CancelURL:         stripe.String(s.config.CancelURL),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(planConfig.PriceID),
				Quantity: stripe.Int64(1),
			},
		},
		SubscriptionData: &stripe.CheckoutSessionSubscriptionDataParams{
			Metadata: map[string]string{
				"user_id": userID,
				"plan":    string(plan),
			},
		},
	}

	session, err := session.New(params)
	if err != nil {
		return "", err
	}

	return session.URL, nil
}

// HandleWebhook processes Stripe webhook events
func (s *PaymentService) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	const MaxBodyBytes = int64(65536)
	r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)
	payload, err := ioutil.ReadAll(r.Body)
	if err != nil {
		log.Printf("Error reading webhook payload: %v", err)
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}

	// Verify webhook signature
	event, err := webhook.ConstructEvent(payload, r.Header.Get("Stripe-Signature"), s.config.WebhookSecret)
	if err != nil {
		log.Printf("Error verifying webhook signature: %v", err)
		http.Error(w, "Failed to verify webhook signature", http.StatusBadRequest)
		return
	}

	// Handle different event types
	switch event.Type {
	case "checkout.session.completed":
		var session stripe.CheckoutSession
		err := json.Unmarshal(event.Data.Raw, &session)
		if err != nil {
			log.Printf("Error parsing webhook payload: %v", err)
			http.Error(w, "Error parsing webhook payload", http.StatusBadRequest)
			return
		}

		// Handle successful subscription
		userID := session.ClientReferenceID
		customerID := session.Customer.ID
		subscriptionID := session.Subscription.ID

		log.Printf("User %s subscribed successfully. Customer ID: %s, Subscription ID: %s",
			userID, customerID, subscriptionID)

		// Here you would typically update your database with the subscription info
		// updateUserSubscription(userID, customerID, subscriptionID)

	case "customer.subscription.updated":
		var subscription stripe.Subscription
		err := json.Unmarshal(event.Data.Raw, &subscription)
		if err != nil {
			http.Error(w, "Error parsing webhook payload", http.StatusBadRequest)
			return
		}

		// Handle subscription updates
		log.Printf("Subscription %s updated. Status: %s",
			subscription.ID, subscription.Status)

		// Update subscription status in your database
		// updateSubscriptionStatus(subscription.ID, subscription.Status)

	case "customer.subscription.deleted":
		var subscription stripe.Subscription
		err := json.Unmarshal(event.Data.Raw, &subscription)
		if err != nil {
			http.Error(w, "Error parsing webhook payload", http.StatusBadRequest)
			return
		}

		// Handle canceled subscriptions
		log.Printf("Subscription %s canceled", subscription.ID)

		// Update subscription status in your database
		// markSubscriptionCanceled(subscription.ID)
	}

	w.WriteHeader(http.StatusOK)
}

// CancelSubscription cancels a user's subscription
func (s *PaymentService) CancelSubscription(subscriptionID string) error {
	params := &stripe.SubscriptionParams{
		CancelAtPeriodEnd: stripe.Bool(true),
	}

	_, err := subscription.Update(subscriptionID, params)
	return err
}

// GetSubscriptionDetails retrieves details about a subscription
func (s *PaymentService) GetSubscriptionDetails(subscriptionID string) (*stripe.Subscription, error) {
	return subscription.Get(subscriptionID, nil)
}
