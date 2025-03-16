package auth

import (
	"context"
	"net/http"
	"strings"
	"time"

	jwtmiddleware "github.com/auth0/go-jwt-middleware/v2"
	"github.com/auth0/go-jwt-middleware/v2/validator"
)

type Auth0Config struct {
	Domain       string
	ClientID     string
	ClientSecret string
	Audience     string
	Issuer       string
}

// CustomClaims contains custom data we want from the token.
type CustomClaims struct {
	Scope string `json:"scope"`
}

// Validate does nothing for this example, but we need
// it to satisfy validator.CustomClaims interface.
func (c CustomClaims) Validate(ctx context.Context) error {
	return nil
}

// HasScope checks if the JWT has a specific scope.
func (c CustomClaims) HasScope(expectedScope string) bool {
	scopes := strings.Split(c.Scope, " ")
	for _, scope := range scopes {
		if scope == expectedScope {
			return true
		}
	}
	return false
}

type AuthService struct {
	config       Auth0Config
	jwtValidator *validator.Validator
}

func NewAuthService(config Auth0Config) (*AuthService, error) {
	issuerURL := "https://" + config.Domain + "/"

	provider := jwks.NewCachingProvider(issuerURL+".well-known/jwks.json", 5*time.Minute)

	jwtValidator, err := validator.New(
		provider.KeyFunc,
		validator.RS256,
		issuerURL,
		[]string{config.Audience},
		validator.WithCustomClaims(
			func() validator.CustomClaims {
				return &CustomClaims{}
			},
		),
		validator.WithAllowedClockSkew(time.Minute),
	)
	if err != nil {
		return nil, err
	}

	return &AuthService{
		config:       config,
		jwtValidator: jwtValidator,
	}, nil
}

// AuthMiddleware creates a middleware that validates JWT tokens
func (a *AuthService) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, err := jwtmiddleware.AuthHeaderTokenExtractor(r)
		if err != nil {
			http.Error(w, "Failed to extract bearer token", http.StatusUnauthorized)
			return
		}

		claims, err := a.jwtValidator.ValidateToken(r.Context(), token)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}

		// Add user claims to request context
		r = r.WithContext(context.WithValue(r.Context(), "user", claims.(*validator.ValidatedClaims)))

		// Call the next handler
		next.ServeHTTP(w, r)
	})
}

// CheckScope validates if the user has the required scope
func (a *AuthService) CheckScope(scope string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value("user").(*validator.ValidatedClaims)
			if !ok {
				http.Error(w, "Requires authentication", http.StatusUnauthorized)
				return
			}

			customClaims, ok := claims.CustomClaims.(*CustomClaims)
			if !ok {
				http.Error(w, "Failed to parse custom claims", http.StatusInternalServerError)
				return
			}

			if !customClaims.HasScope(scope) {
				http.Error(w, "Insufficient permissions", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
