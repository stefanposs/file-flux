package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/stefanposs/file-flux/backend/internal/config"
	"github.com/stefanposs/file-flux/backend/internal/models"

	_ "github.com/lib/pq"
)

// Database repräsentiert die Datenbankverbindung und -operationen
type Database struct {
	db *sql.DB
}

// NewDatabase erstellt eine neue Datenbankverbindung
func NewDatabase(cfg config.DatabaseConfig) (*Database, error) {
	connStr := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Database, cfg.SSLMode,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("fehler beim Öffnen der Datenbankverbindung: %v", err)
	}

	// Connection Pool Konfiguration
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("fehler beim Ping der Datenbank: %v", err)
	}

	return &Database{db: db}, nil
}

// Close schließt die Datenbankverbindung
func (d *Database) Close() error {
	return d.db.Close()
}

// Initialize erstellt die notwendigen Tabellen in der Datenbank
func (d *Database) Initialize() error {
	// Try multiple paths: works both locally and inside Docker container
	candidates := []string{
		filepath.Join("internal", "db", "schema.sql"),
		filepath.Join("migrations", "schema.sql"),
		"schema.sql",
	}

	var schema []byte
	var err error
	for _, p := range candidates {
		schema, err = os.ReadFile(p)
		if err == nil {
			break
		}
	}
	if err != nil {
		return fmt.Errorf("fehler beim Lesen der Schema-Datei (tried %v): %v", candidates, err)
	}

	_, err = d.db.Exec(string(schema))
	if err != nil {
		return fmt.Errorf("fehler beim Ausführen des Schemas: %v", err)
	}

	return nil
}

// ============================================================
// User-Methoden
// ============================================================

// GetUser gibt einen Benutzer anhand seiner ID zurück
func (d *Database) GetUser(id int) (*models.User, error) {
	var user models.User
	err := d.db.QueryRow(`
		SELECT id, name, email, password_hash, role, created_at, last_login
		FROM users WHERE id = $1
	`, id).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash,
		&user.Role, &user.CreatedAt, &user.LastLogin,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByEmail gibt einen Benutzer anhand seiner E-Mail zurück
func (d *Database) GetUserByEmail(email string) (*models.User, error) {
	var user models.User
	err := d.db.QueryRow(`
		SELECT id, name, email, password_hash, role, created_at, last_login
		FROM users WHERE email = $1
	`, email).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash,
		&user.Role, &user.CreatedAt, &user.LastLogin,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// UpdateLastLogin aktualisiert den letzten Login-Zeitpunkt
func (d *Database) UpdateLastLogin(userID int) error {
	_, err := d.db.Exec(`UPDATE users SET last_login = NOW() WHERE id = $1`, userID)
	return err
}

// ============================================================
// Agent-Methoden
// ============================================================

// GetAgents gibt alle Agenten zurück
func (d *Database) GetAgents() ([]models.Agent, error) {
	rows, err := d.db.Query(`
		SELECT id, name, type, status, ip_address, system, version, last_seen, description, created_at
		FROM agents ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var agents []models.Agent
	for rows.Next() {
		var agent models.Agent
		err := rows.Scan(
			&agent.ID, &agent.Name, &agent.Type, &agent.Status,
			&agent.IPAddress, &agent.System, &agent.Version,
			&agent.LastSeen, &agent.Description, &agent.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		agents = append(agents, agent)
	}
	return agents, nil
}

// GetAgent gibt einen Agenten anhand seiner ID zurück
func (d *Database) GetAgent(id int) (*models.Agent, error) {
	var agent models.Agent
	err := d.db.QueryRow(`
		SELECT id, name, type, status, ip_address, system, version, last_seen, description, created_at
		FROM agents WHERE id = $1
	`, id).Scan(
		&agent.ID, &agent.Name, &agent.Type, &agent.Status,
		&agent.IPAddress, &agent.System, &agent.Version,
		&agent.LastSeen, &agent.Description, &agent.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &agent, nil
}

// CreateAgent erstellt einen neuen Agenten
func (d *Database) CreateAgent(agent *models.Agent) error {
	return d.db.QueryRow(`
		INSERT INTO agents (name, type, status, description)
		VALUES ($1, $2, $3, $4) RETURNING id, created_at
	`, agent.Name, agent.Type, agent.Status, agent.Description).Scan(&agent.ID, &agent.CreatedAt)
}

// UpdateAgent aktualisiert einen bestehenden Agenten
func (d *Database) UpdateAgent(agent *models.Agent) error {
	_, err := d.db.Exec(`
		UPDATE agents SET name = $1, type = $2, status = $3, description = $4
		WHERE id = $5
	`, agent.Name, agent.Type, agent.Status, agent.Description, agent.ID)
	return err
}

// UpdateAgentStatus aktualisiert den Status eines Agenten
func (d *Database) UpdateAgentStatus(id int, status string) error {
	_, err := d.db.Exec(`
		UPDATE agents SET status = $1, last_seen = NOW() WHERE id = $2
	`, status, id)
	return err
}

// DeleteAgent löscht einen Agenten
func (d *Database) DeleteAgent(id int) error {
	_, err := d.db.Exec(`DELETE FROM agents WHERE id = $1`, id)
	return err
}

// ============================================================
// Token-Methoden
// ============================================================

// ValidateAgentToken überprüft ein Token und gibt die zugehörige Agent-ID zurück
func (d *Database) ValidateAgentToken(tokenValue string) (int, error) {
	var agentID int
	var expiresAt *time.Time

	err := d.db.QueryRow(`
		SELECT agent_id, expires_at FROM tokens
		WHERE token_value = $1
	`, tokenValue).Scan(&agentID, &expiresAt)
	if err != nil {
		return 0, fmt.Errorf("token nicht gefunden: %v", err)
	}

	// Prüfe ob Token abgelaufen
	if expiresAt != nil && expiresAt.Before(time.Now()) {
		return 0, fmt.Errorf("token abgelaufen")
	}

	// last_used aktualisieren
	_, _ = d.db.Exec(`UPDATE tokens SET last_used = NOW() WHERE token_value = $1`, tokenValue)

	return agentID, nil
}

// GetTokens gibt alle Tokens zurück
func (d *Database) GetTokens() ([]models.Token, error) {
	rows, err := d.db.Query(`
		SELECT id, agent_id, name, token_value, created_at, expires_at, last_used, description
		FROM tokens ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []models.Token
	for rows.Next() {
		var t models.Token
		err := rows.Scan(
			&t.ID, &t.AgentID, &t.Name, &t.TokenValue,
			&t.CreatedAt, &t.ExpiresAt, &t.LastUsed, &t.Description,
		)
		if err != nil {
			return nil, err
		}
		// Token-Wert maskieren (nur ersten 8 Zeichen zeigen)
		if len(t.TokenValue) > 8 {
			t.TokenValue = t.TokenValue[:8] + "..."
		}
		tokens = append(tokens, t)
	}
	return tokens, nil
}

// CreateToken erstellt ein neues Token
func (d *Database) CreateToken(agentID int, name, tokenValue string, description *string, expiresAt *time.Time) (*models.Token, error) {
	var token models.Token
	err := d.db.QueryRow(`
		INSERT INTO tokens (agent_id, name, token_value, description, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, agent_id, name, token_value, created_at, expires_at, last_used, description
	`, agentID, name, tokenValue, description, expiresAt).Scan(
		&token.ID, &token.AgentID, &token.Name, &token.TokenValue,
		&token.CreatedAt, &token.ExpiresAt, &token.LastUsed, &token.Description,
	)
	if err != nil {
		return nil, err
	}
	return &token, nil
}

// DeleteToken löscht ein Token
func (d *Database) DeleteToken(id int) error {
	_, err := d.db.Exec(`DELETE FROM tokens WHERE id = $1`, id)
	return err
}

// ============================================================
// Job-Methoden
// ============================================================

// GetJobs gibt alle Jobs eines Benutzers zurück
func (d *Database) GetJobs(userID int) ([]models.Job, error) {
	rows, err := d.db.Query(`
		SELECT id, user_id, name, type, status, schedule, source_path, destination_path,
		       source_agent_id, destination_agent_id, last_run, next_run, description, created_at
		FROM jobs WHERE user_id = $1 ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []models.Job
	for rows.Next() {
		var j models.Job
		err := rows.Scan(
			&j.ID, &j.UserID, &j.Name, &j.Type, &j.Status, &j.Schedule,
			&j.SourcePath, &j.DestinationPath,
			&j.SourceAgentID, &j.DestinationAgentID,
			&j.LastRun, &j.NextRun, &j.Description, &j.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, j)
	}
	return jobs, nil
}

// GetJob gibt einen einzelnen Job zurück
func (d *Database) GetJob(id int) (*models.Job, error) {
	var j models.Job
	err := d.db.QueryRow(`
		SELECT id, user_id, name, type, status, schedule, source_path, destination_path,
		       source_agent_id, destination_agent_id, last_run, next_run, description, created_at
		FROM jobs WHERE id = $1
	`, id).Scan(
		&j.ID, &j.UserID, &j.Name, &j.Type, &j.Status, &j.Schedule,
		&j.SourcePath, &j.DestinationPath,
		&j.SourceAgentID, &j.DestinationAgentID,
		&j.LastRun, &j.NextRun, &j.Description, &j.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &j, nil
}

// CreateJob erstellt einen neuen Job
func (d *Database) CreateJob(job *models.Job) error {
	return d.db.QueryRow(`
		INSERT INTO jobs (user_id, name, type, status, schedule, source_path, destination_path,
		                  source_agent_id, destination_agent_id, description)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at
	`, job.UserID, job.Name, job.Type, job.Status, job.Schedule,
		job.SourcePath, job.DestinationPath,
		job.SourceAgentID, job.DestinationAgentID, job.Description,
	).Scan(&job.ID, &job.CreatedAt)
}

// UpdateJob aktualisiert einen Job
func (d *Database) UpdateJob(job *models.Job) error {
	_, err := d.db.Exec(`
		UPDATE jobs SET name = $1, type = $2, status = $3, schedule = $4,
		               source_path = $5, destination_path = $6,
		               source_agent_id = $7, destination_agent_id = $8, description = $9
		WHERE id = $10
	`, job.Name, job.Type, job.Status, job.Schedule,
		job.SourcePath, job.DestinationPath,
		job.SourceAgentID, job.DestinationAgentID, job.Description, job.ID,
	)
	return err
}

// DeleteJob löscht einen Job
func (d *Database) DeleteJob(id int) error {
	_, err := d.db.Exec(`DELETE FROM jobs WHERE id = $1`, id)
	return err
}

// GetJobCount gibt die Anzahl der Jobs eines Benutzers zurück
func (d *Database) GetJobCount(userID int) (int, error) {
	var count int
	err := d.db.QueryRow(`SELECT COUNT(*) FROM jobs WHERE user_id = $1`, userID).Scan(&count)
	return count, err
}

// ============================================================
// Transfer-Methoden
// ============================================================

// GetTransfers gibt alle Transfers zurück (gefiltert nach User über Jobs)
func (d *Database) GetTransfers(userID int) ([]models.Transfer, error) {
	rows, err := d.db.Query(`
		SELECT t.id, t.job_id, t.filename, t.size, t.status,
		       t.source_path, t.destination_path,
		       t.source_agent_id, t.destination_agent_id,
		       t.start_time, t.end_time, t.error, t.created_at
		FROM transfers t
		LEFT JOIN jobs j ON t.job_id = j.id
		WHERE j.user_id = $1 OR t.job_id IS NULL
		ORDER BY t.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transfers []models.Transfer
	for rows.Next() {
		var t models.Transfer
		err := rows.Scan(
			&t.ID, &t.JobID, &t.Filename, &t.Size, &t.Status,
			&t.SourcePath, &t.DestinationPath,
			&t.SourceAgentID, &t.DestinationAgentID,
			&t.StartTime, &t.EndTime, &t.Error, &t.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		transfers = append(transfers, t)
	}
	return transfers, nil
}

// GetTransfer gibt einen einzelnen Transfer zurück
func (d *Database) GetTransfer(id int) (*models.Transfer, error) {
	var t models.Transfer
	err := d.db.QueryRow(`
		SELECT id, job_id, filename, size, status, source_path, destination_path,
		       source_agent_id, destination_agent_id, start_time, end_time, error, created_at
		FROM transfers WHERE id = $1
	`, id).Scan(
		&t.ID, &t.JobID, &t.Filename, &t.Size, &t.Status,
		&t.SourcePath, &t.DestinationPath,
		&t.SourceAgentID, &t.DestinationAgentID,
		&t.StartTime, &t.EndTime, &t.Error, &t.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// CreateTransfer erstellt einen neuen Transfer
func (d *Database) CreateTransfer(transfer *models.Transfer) error {
	return d.db.QueryRow(`
		INSERT INTO transfers (job_id, filename, size, status, source_path, destination_path,
		                       source_agent_id, destination_agent_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, start_time, created_at
	`, transfer.JobID, transfer.Filename, transfer.Size, transfer.Status,
		transfer.SourcePath, transfer.DestinationPath,
		transfer.SourceAgentID, transfer.DestinationAgentID,
	).Scan(&transfer.ID, &transfer.StartTime, &transfer.CreatedAt)
}

// UpdateTransferStatus aktualisiert den Status eines Transfers
func (d *Database) UpdateTransferStatus(id int, status string, errorMsg string) error {
	if errorMsg != "" {
		_, err := d.db.Exec(`
			UPDATE transfers SET status = $1, error = $2, end_time = NOW() WHERE id = $3
		`, status, errorMsg, id)
		return err
	}
	_, err := d.db.Exec(`
		UPDATE transfers SET status = $1, end_time = NOW() WHERE id = $2
	`, status, id)
	return err
}
