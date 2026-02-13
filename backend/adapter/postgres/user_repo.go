package postgres

import (
	"context"
	"database/sql"

	"github.com/stefanposs/file-flux/backend/domain/common"
	"github.com/stefanposs/file-flux/backend/domain/user"
)

// UserRepo implementiert user.Repository mit PostgreSQL.
type UserRepo struct {
	db *sql.DB
}

// NewUserRepo erstellt ein neues UserRepo.
func NewUserRepo(pgdb *DB) *UserRepo {
	return &UserRepo{db: pgdb.Pool}
}

var _ user.Repository = (*UserRepo)(nil)

func (r *UserRepo) GetByID(ctx context.Context, id int) (*user.User, error) {
	var u user.User
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, email, password_hash, role, created_at, last_login
		FROM users WHERE id = $1
	`, id).Scan(
		&u.ID, &u.Name, &u.Email, &u.PasswordHash,
		&u.Role, &u.CreatedAt, &u.LastLogin,
	)
	if err == sql.ErrNoRows {
		return nil, common.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) GetByEmail(ctx context.Context, email string) (*user.User, error) {
	var u user.User
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, email, password_hash, role, created_at, last_login
		FROM users WHERE email = $1
	`, email).Scan(
		&u.ID, &u.Name, &u.Email, &u.PasswordHash,
		&u.Role, &u.CreatedAt, &u.LastLogin,
	)
	if err == sql.ErrNoRows {
		return nil, common.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) Create(ctx context.Context, u *user.User) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO users (name, email, password_hash, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at
	`, u.Name, u.Email, u.PasswordHash, u.Role).Scan(&u.ID, &u.CreatedAt)
}

func (r *UserRepo) UpdateLastLogin(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET last_login = NOW() WHERE id = $1`, id)
	return err
}
