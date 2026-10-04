package com.boutique.backend.exception;

import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GestionnaireExceptions {

    private static final Logger log = LoggerFactory.getLogger(GestionnaireExceptions.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> validationCorps(MethodArgumentNotValidException exception) {
        Map<String, String> champs = new HashMap<>();
        exception.getBindingResult().getFieldErrors()
                .forEach(erreur -> champs.put(erreur.getField(), erreur.getDefaultMessage()));
        return ResponseEntity.badRequest()
                .body(ApiError.de(400, "Requête invalide", champs));
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ApiError> validationParametres(HandlerMethodValidationException exception) {
        return ResponseEntity.badRequest()
                .body(ApiError.de(400, "Paramètres de requête invalides"));
    }

    /**
     * Paramètre de requête inconvertible : une date écrite « 03/10/2026 » plutôt
     * qu'en ISO, par exemple. C'est une faute du client, pas du serveur — sans
     * ce cas, elle tombait dans le fourre-tout et ressortait en 500.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiError> parametreInconvertible(MethodArgumentTypeMismatchException exception) {
        return ResponseEntity.badRequest().body(ApiError.de(400, "Paramètre invalide",
                Map.of(exception.getName(), "Valeur attendue au format yyyy-MM-dd")));
    }

    @ExceptionHandler(RessourceIntrouvableException.class)
    ResponseEntity<ApiError> introuvable(RessourceIntrouvableException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.de(404, exception.getMessage()));
    }

    @ExceptionHandler(ConflitException.class)
    ResponseEntity<ApiError> conflit(ConflitException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.de(409, exception.getMessage()));
    }

    /** Contrainte d'unicité ou de clé étrangère violée malgré les contrôles applicatifs. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> integrite(DataIntegrityViolationException exception) {
        log.warn("Violation de contrainte en base", exception);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.de(409, "Opération refusée : contrainte de données violée"));
    }

    /** Deux opérations ont modifié le même stock en même temps. */
    @ExceptionHandler(OptimisticLockingFailureException.class)
    ResponseEntity<ApiError> concurrence(OptimisticLockingFailureException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiError.de(409,
                        "Ce produit vient d'être modifié par une autre opération, réessayez"));
    }

    /** Blocage anti-bourrage : on indique au client quand réessayer. */
    @ExceptionHandler(TropDeTentativesException.class)
    ResponseEntity<ApiError> tropDeTentatives(TropDeTentativesException exception) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER,
                        String.valueOf(Math.max(exception.attenteRestante().toSeconds(), 1)))
                .body(ApiError.de(429, exception.getMessage()));
    }

    @ExceptionHandler(DisabledException.class)
    ResponseEntity<ApiError> compteDesactive(DisabledException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiError.de(403, "Ce compte est désactivé"));
    }

    /**
     * Message volontairement générique : ne pas révéler si c'est l'identifiant
     * ou le mot de passe qui est faux.
     */
    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ApiError> authentification(AuthenticationException exception) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiError.de(401, "Identifiant ou mot de passe incorrect"));
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiError> accesRefuse(AccessDeniedException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiError.de(403, "Votre rôle ne permet pas cette opération"));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> inattendue(Exception exception) {
        log.error("Erreur non gérée", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.de(500, "Erreur interne du serveur"));
    }
}
