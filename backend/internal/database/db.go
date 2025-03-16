package database

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/stefanposs/file-flux/backend/internal/models"
)

// Database interface defines methods for interacting with the database
type Database interface {
	// User methods
	CreateUser(ctx context.Context, user models.User) (models.User, error)
	GetUser(ctx context.Context, id string) (models.User, error)
	GetUserByEmail(ctx context.Context, email string) (models.User, error)
	UpdateUser(ctx context.Context, user models.User) error
	DeleteUser(ctx context.Context, id string) error

	// Organization methods
	CreateOrganization(ctx context.Context, org models.Organization) (models.Organization, error)
	GetOrganization(ctx context.Context, id string) (models.Organization, error)
	UpdateOrganization(ctx context.Context, org models.Organization) error
	DeleteOrganization(ctx context.Context, id string) error

	// Job methods
	CreateJob(ctx context.Context, job models.Job) (models.Job, error)
	GetJob(ctx context.Context, id string) (models.Job, error)
	GetJobsByOrganization(ctx context.Context, orgID string) ([]models.Job, error)
	UpdateJob(ctx context.Context, job models.Job) error
	DeleteJob(ctx context.Context, id string) error

	// Agent methods
	CreateAgent(ctx context.Context, agent models.Agent) (models.Agent, error)
	GetAgent(ctx context.Context, id string) (models.Agent, error)
	GetAgentsByOrganization(ctx context.Context, orgID string) ([]models.Agent, error)
	UpdateAgent(ctx context.Context, agent models.Agent) error
	DeleteAgent(ctx context.Context, id string) error

	// Transfer methods
	CreateTransfer(ctx context.Context, transfer models.Transfer) (models.Transfer, error)
	GetTransfer(ctx context.Context, id string) (models.Transfer, error)
	GetTransfersByJob(ctx context.Context, jobID string) ([]models.Transfer, error)
	UpdateTransfer(ctx context.Context, transfer models.Transfer) error

	// Event methods
	CreateEvent(ctx context.Context, event models.Event) (models.Event, error)
	GetEvents(ctx context.Context, filter map[string]interface{}, limit, offset int) ([]models.Event, error)
}

type PostgresDB struct {
	db *sql.DB
}

func NewPostgresDB(connStr string) (*PostgresDB, error) {
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		return nil, err
	}

	return &PostgresDB{db: db}, nil
}

// Implementation of the User methods
func (p *PostgresDB) CreateUser(ctx context.Context, user models.User) (models.User, error) {
	if user.ID == "" {
		user.ID = uuid.New().String()
	}

	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now

	_, err := p.db.ExecContext(ctx,
		`INSERT INTO users (id, email, name, role, created_at, updated_at, stripe_id, subscription_id, plan) 
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		user.ID, user.Email, user.Name, user.Role, user.CreatedAt, user.UpdatedAt,
		user.StripeID, user.SubscriptionID, user.Plan)

	if err != nil {
		return models.User{}, err
	}

	return user, nil
}

func (p *PostgresDB) GetUser(ctx context.Context, id string) (models.User, error) {
	var user models.User

	err := p.db.QueryRowContext(ctx,
		`SELECT id, email, name, role, created_at, updated_at, stripe_id, subscription_id, plan 
		FROM users WHERE id = $1`, id).Scan(
		&user.ID, &user.Email, &user.Name, &user.Role, &user.CreatedAt, &user.UpdatedAt,
		&user.StripeID, &user.SubscriptionID, &user.Plan)

	if err != nil {
		if err == sql.ErrNoRows {
			return models.User{}, errors.New("user not found")
		}
		return models.User{}, err
	}

	return user, nil
}

// Implementation for other methods would follow the same pattern
// This is a simplified version for demonstration purposes

func (p *PostgresDB) Close() error {
	return p.db.Close()
}
