// Package auth implementiert den Authentifizierungs-Service der Application-Schicht.
package auth

import (
	"context"
	"errors"
	"time"

	"github.com/stefanposs/file-flux/backend/domain/common"
	"github.com/stefanposs/file-flux/backend/domain/user"
	"golang.org/x/crypto/bcrypt"
)

// TokenGenerator definiert die Schnittstelle fuer JWT-Token-Erzeugung.
type TokenGenerator interface {
	Generate(userID int, role string, expiresInHours int) (string, error)
}

// LoginResult enthaelt das Ergebnis einer erfolgreichen Anmeldung.
type LoginResult struct {
	Token     string
	ExpiresAt time.Time
	User      *user.User
}

// Service implementiert die Authentifizierungs-Geschaeftslogik.
type Service struct {
	users          user.Repository
	tokenGenerator TokenGenerator
	tokenExpiry    int
}

// NewService erstellt einen neuen AuthService.
func NewService(users user.Repository, tokenGen TokenGenerator, tokenExpiry int) *Service {
	if tokenExpiry <= 0 {
		tokenExpiry = 24
	}
	return &Service{
		users:          users,
		tokenGenerator: tokenGen,
		tokenExpiry:    tokenExpiry,
	}
}

// Login authentifiziert einen Benutzer mit E-Mail und Passwort.
func (s *Service) Login(ctx context.Context, email, password string) (*LoginResult, error) {
	if email == "" || password == "" {
		return nil, errors.Join(common.ErrValidation, errors.New("email and password required"))
	}

	u, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		return nil, common.ErrUnauthorized
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)); err != nil {
		return nil, common.ErrUnauthorized
	}

	token, err := s.tokenGenerator.Generate(u.ID, string(u.Role), s.tokenExpiry)
	if err != nil {
		return nil, errors.Join(common.ErrInternal, err)
	}

	_ = s.users.UpdateLastLogin(ctx, u.ID)

	return &LoginResult{
		Token:     token,
		ExpiresAt: time.Now().Add(time.Duration(s.tokenExpiry) * time.Hour),
		User:      u,
	}, nil
}

// RefreshToken erzeugt ein neues Token fuer einen bereits authentifizierten Benutzer.
func (s *Service) RefreshToken(ctx context.Context, userID int) (*LoginResult, error) {
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return nil, common.ErrUnauthorized
	}

	token, err := s.tokenGenerator.Generate(u.ID, string(u.Role), s.tokenExpiry)
	if err != nil {
		return nil, errors.Join(common.ErrInternal, err)
	}

	return &LoginResult{
		Token:     token,
		ExpiresAt: time.Now().Add(time.Duration(s.tokenExpiry) * time.Hour),
		User:      u,
	}, nil
}

// GetCurrentUser gibt den aktuellen Benutzer zurueck.
func (s *Service) GetCurrentUser(ctx context.Context, userID int) (*user.User, error) {
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return nil, common.ErrNotFound
	}
	return u, nil
}

// ChangePassword aendert das Passwort eines authentifizierten Benutzers.
func (s *Service) ChangePassword(ctx context.Context, userID int, currentPassword, newPassword string) error {
	if currentPassword == "" || newPassword == "" {
		return errors.Join(common.ErrValidation, errors.New("current and new password required"))
	}
	if len(newPassword) < 8 {
		return errors.Join(common.ErrValidation, errors.New("new password must be at least 8 characters"))
	}

	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return common.ErrNotFound
	}

	// Aktuelles Passwort verifizieren
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(currentPassword)); err != nil {
		return errors.Join(common.ErrUnauthorized, errors.New("current password is incorrect"))
	}

	// Neues Passwort hashen
	hash, err := HashPassword(newPassword)
	if err != nil {
		return errors.Join(common.ErrInternal, err)
	}

	return s.users.UpdatePassword(ctx, userID, hash)
}

// HashPassword erstellt einen bcrypt-Hash eines Passworts.
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}
