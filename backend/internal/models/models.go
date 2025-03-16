package models

import (
	"time"
)

// User represents a user account in the system
type User struct {
	ID             string                 `json:"id"`
	Email          string                 `json:"email"`
	Name           string                 `json:"name"`
	Role           string                 `json:"role"` // admin, user, etc.
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
	StripeID       string                 `json:"-"`                         // Stripe customer ID
	SubscriptionID string                 `json:"-"`                         // Stripe subscription ID
	Plan           string                 `json:"plan"`                      // free, hobby, business
	OrganizationID string                 `json:"organization_id,omitempty"` // Associated organization
	LastLoginAt    time.Time              `json:"last_login_at,omitempty"`
	IsActive       bool                   `json:"is_active"`
	Settings       map[string]interface{} `json:"settings,omitempty"`
}

// Organization represents a customer organization
type Organization struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	OwnerID         string    `json:"owner_id"` // User ID of the owner
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	StripeID        string    `json:"-"`    // Stripe customer ID
	SubscriptionID  string    `json:"-"`    // Stripe subscription ID
	Plan            string    `json:"plan"` // free, hobby, business
	BillingEmail    string    `json:"billing_email,omitempty"`
	BillingAddress  string    `json:"billing_address,omitempty"`
	ContactPerson   string    `json:"contact_person,omitempty"`
	PhoneNumber     string    `json:"phone_number,omitempty"`
	MaxJobs         int       `json:"max_jobs,omitempty"`
	MaxAgents       int       `json:"max_agents,omitempty"`
	MaxTransferSize int64     `json:"max_transfer_size,omitempty"`
	IsActive        bool      `json:"is_active"`
}

// Job represents a file transfer job configuration
type Job struct {
	ID                 string                 `json:"id"`
	Name               string                 `json:"name"`
	Description        string                 `json:"description"`
	OrganizationID     string                 `json:"organization_id"`
	CreatedByID        string                 `json:"created_by_id"`
	CreatedAt          time.Time              `json:"created_at"`
	UpdatedAt          time.Time              `json:"updated_at"`
	Status             string                 `json:"status"` // active, paused, archived
	UploadToken        string                 `json:"upload_token,omitempty"`
	DownloadToken      string                 `json:"download_token,omitempty"`
	SourceType         string                 `json:"source_type,omitempty"` // local, ftp, s3, etc.
	SourceConfig       map[string]interface{} `json:"source_config,omitempty"`
	DestType           string                 `json:"dest_type,omitempty"` // local, ftp, s3, etc.
	DestConfig         map[string]interface{} `json:"dest_config,omitempty"`
	Schedule           string                 `json:"schedule,omitempty"`     // cron expression for scheduled jobs
	RetryPolicy        string                 `json:"retry_policy,omitempty"` // none, linear, exponential
	MaxRetries         int                    `json:"max_retries,omitempty"`
	CompressionEnabled bool                   `json:"compression_enabled"`
	ChunkSize          int                    `json:"chunk_size,omitempty"`    // in bytes, 0 = no chunking
	Notifications      []string               `json:"notifications,omitempty"` // email, slack, etc.
}

// Agent represents a file transfer agent installation
type Agent struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	OrganizationID string    `json:"organization_id"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	LastSeen       time.Time `json:"last_seen"`
	Status         string    `json:"status"` // online, offline
	Version        string    `json:"version"`
	OS             string    `json:"os,omitempty"` // windows, linux, etc.
	HostName       string    `json:"host_name,omitempty"`
	IPAddress      string    `json:"ip_address,omitempty"`
	Tags           []string  `json:"tags,omitempty"`
	ConfiguredJobs []string  `json:"configured_jobs,omitempty"` // List of job IDs
	Health         string    `json:"health,omitempty"`          // healthy, warning, error
	HealthDetails  string    `json:"health_details,omitempty"`
}

// Transfer represents a single file transfer operation
type Transfer struct {
	ID               string     `json:"id"`
	JobID            string     `json:"job_id"`
	FileName         string     `json:"file_name"`
	FileSize         int64      `json:"file_size"`
	CompressedSize   int64      `json:"compressed_size,omitempty"` // Size after compression
	StartedAt        time.Time  `json:"started_at"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
	Status           string     `json:"status"`             // started, in_progress, completed, failed
	Progress         float64    `json:"progress,omitempty"` // 0-100
	BytesTransferred int64      `json:"bytes_transferred,omitempty"`
	ErrorMessage     string     `json:"error_message,omitempty"`
	SourceAgent      string     `json:"source_agent"`
	DestinationAgent string     `json:"destination_agent"`
	MD5Hash          string     `json:"md5_hash,omitempty"` // File integrity check
	RetryCount       int        `json:"retry_count,omitempty"`
	TransferRate     float64    `json:"transfer_rate,omitempty"` // Bytes per second
	IsCompressed     bool       `json:"is_compressed"`
}

// Event represents a system event
type Event struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"` // job.created, transfer.started, etc.
	JobID       string                 `json:"job_id,omitempty"`
	TransferID  string                 `json:"transfer_id,omitempty"`
	AgentID     string                 `json:"agent_id,omitempty"`
	UserID      string                 `json:"user_id,omitempty"`
	Timestamp   time.Time              `json:"timestamp"`
	Description string                 `json:"description"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	Level       string                 `json:"level,omitempty"` // info, warning, error
}

// Pricing represents a subscription plan pricing
type Pricing struct {
	ID                   string   `json:"id"`
	Name                 string   `json:"name"` // Free, Hobby, Business
	Description          string   `json:"description"`
	Monthly              float64  `json:"monthly_price"`
	Yearly               float64  `json:"yearly_price"`
	Currency             string   `json:"currency"`
	StripePriceIDMonthly string   `json:"-"`
	StripePriceIDYearly  string   `json:"-"`
	Features             []string `json:"features"`
	MaxJobs              int      `json:"max_jobs"`
	MaxAgents            int      `json:"max_agents"`
	MaxStorage           int64    `json:"max_storage"`       // In bytes
	MaxTransferSize      int64    `json:"max_transfer_size"` // In bytes
	SupportLevel         string   `json:"support_level"`
	IsActive             bool     `json:"is_active"`
}

// Subscription represents a customer's subscription
type Subscription struct {
	ID                 string                 `json:"id"`
	OrganizationID     string                 `json:"organization_id"`
	PricingID          string                 `json:"pricing_id"`
	StripeID           string                 `json:"-"`
	Status             string                 `json:"status"` // active, past_due, canceled, etc.
	CurrentPeriodStart time.Time              `json:"current_period_start"`
	CurrentPeriodEnd   time.Time              `json:"current_period_end"`
	CanceledAt         *time.Time             `json:"canceled_at,omitempty"`
	CancelAtPeriodEnd  bool                   `json:"cancel_at_period_end"`
	CreatedAt          time.Time              `json:"created_at"`
	UpdatedAt          time.Time              `json:"updated_at"`
	PaymentMethod      string                 `json:"payment_method,omitempty"`
	Metadata           map[string]interface{} `json:"metadata,omitempty"`
}

// Invoice represents a billing invoice
type Invoice struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	SubscriptionID string     `json:"subscription_id"`
	StripeID       string     `json:"-"`
	Amount         float64    `json:"amount"`
	Currency       string     `json:"currency"`
	Status         string     `json:"status"` // draft, open, paid, uncollectible, void
	IssueDate      time.Time  `json:"issue_date"`
	DueDate        time.Time  `json:"due_date"`
	PaidAt         *time.Time `json:"paid_at,omitempty"`
	InvoiceNumber  string     `json:"invoice_number"`
	InvoiceURL     string     `json:"invoice_url,omitempty"` // Stripe hosted invoice URL
}

// ApiKey represents an API key for programmatic access
type ApiKey struct {
	ID             string     `json:"id"`
	Name           string     `json:"name"`
	OrganizationID string     `json:"organization_id"`
	CreatedByID    string     `json:"created_by_id"`
	CreatedAt      time.Time  `json:"created_at"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
	LastUsedAt     *time.Time `json:"last_used_at,omitempty"`
	IsActive       bool       `json:"is_active"`
	Permissions    []string   `json:"permissions"`
	HashedKey      string     `json:"-"` // Stored as bcrypt hash
}
