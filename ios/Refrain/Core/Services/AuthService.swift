import Foundation
import Supabase

final class AuthService: Sendable {
    static let shared = AuthService()

    private let supabase = SupabaseService.shared.client

    private init() {}

    // MARK: - Auth State

    struct AuthState: Sendable {
        let user: User?
        let session: Session?
    }

    var authStateChanges: AsyncStream<AuthState> {
        AsyncStream { continuation in
            let task = Task {
                for await (_, session) in supabase.auth.authStateChanges {
                    let user: User?
                    // Check for valid non-expired session
                    if let session = session, !session.isExpired {
                        let supabaseUser = session.user
                        user = User(
                            id: supabaseUser.id.uuidString,
                            email: supabaseUser.email,
                            displayName: supabaseUser.userMetadata["full_name"]?.stringValue,
                            avatarUrl: supabaseUser.userMetadata["avatar_url"]?.stringValue,
                            createdAt: supabaseUser.createdAt
                        )
                    } else {
                        user = nil
                    }
                    continuation.yield(AuthState(user: user, session: session))
                }
            }

            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }

    // MARK: - Get Current User

    func getCurrentUser() async -> User? {
        do {
            let session = try await supabase.auth.session
            // Check if session is expired with the new emitLocalSessionAsInitialSession behavior
            if session.isExpired {
                return nil
            }
            let supabaseUser = session.user
            return User(
                id: supabaseUser.id.uuidString,
                email: supabaseUser.email,
                displayName: supabaseUser.userMetadata["full_name"]?.stringValue,
                avatarUrl: supabaseUser.userMetadata["avatar_url"]?.stringValue,
                createdAt: supabaseUser.createdAt
            )
        } catch {
            return nil
        }
    }

    func getCurrentUserId() async -> String? {
        await getCurrentUser()?.id
    }

    // MARK: - Email/Password Auth

    func signUp(email: String, password: String) async throws -> User {
        let response = try await supabase.auth.signUp(
            email: email,
            password: password
        )

        let supabaseUser = response.user

        return User(
            id: supabaseUser.id.uuidString,
            email: supabaseUser.email,
            displayName: nil,
            avatarUrl: nil,
            createdAt: supabaseUser.createdAt
        )
    }

    func signIn(email: String, password: String) async throws -> User {
        let session = try await supabase.auth.signIn(
            email: email,
            password: password
        )

        let supabaseUser = session.user
        return User(
            id: supabaseUser.id.uuidString,
            email: supabaseUser.email,
            displayName: supabaseUser.userMetadata["full_name"]?.stringValue,
            avatarUrl: supabaseUser.userMetadata["avatar_url"]?.stringValue,
            createdAt: supabaseUser.createdAt
        )
    }

    // MARK: - OAuth

    func signInWithGoogle(
        launchFlow: @MainActor @Sendable (_ url: URL) async throws -> URL
    ) async throws -> User {
        let session = try await supabase.auth.signInWithOAuth(
            provider: .google,
            redirectTo: URL(string: Config.oauthCallbackUrl),
            launchFlow: launchFlow
        )

        let supabaseUser = session.user
        return User(
            id: supabaseUser.id.uuidString,
            email: supabaseUser.email,
            displayName: supabaseUser.userMetadata["full_name"]?.stringValue,
            avatarUrl: supabaseUser.userMetadata["avatar_url"]?.stringValue,
            createdAt: supabaseUser.createdAt
        )
    }

    func signInWithApple(
        launchFlow: @MainActor @Sendable (_ url: URL) async throws -> URL
    ) async throws -> User {
        let session = try await supabase.auth.signInWithOAuth(
            provider: .apple,
            redirectTo: URL(string: Config.oauthCallbackUrl),
            launchFlow: launchFlow
        )

        let supabaseUser = session.user
        return User(
            id: supabaseUser.id.uuidString,
            email: supabaseUser.email,
            displayName: supabaseUser.userMetadata["full_name"]?.stringValue,
            avatarUrl: supabaseUser.userMetadata["avatar_url"]?.stringValue,
            createdAt: supabaseUser.createdAt
        )
    }

    // MARK: - Handle OAuth Callback

    func handleOAuthCallback(url: URL) async throws -> User {
        let session = try await supabase.auth.session(from: url)
        let supabaseUser = session.user
        return User(
            id: supabaseUser.id.uuidString,
            email: supabaseUser.email,
            displayName: supabaseUser.userMetadata["full_name"]?.stringValue,
            avatarUrl: supabaseUser.userMetadata["avatar_url"]?.stringValue,
            createdAt: supabaseUser.createdAt
        )
    }

    // MARK: - Sign Out

    func signOut() async throws {
        try await supabase.auth.signOut()
    }

    // MARK: - Password Reset

    func sendPasswordResetEmail(email: String) async throws {
        try await supabase.auth.resetPasswordForEmail(email)
    }

    func updatePassword(newPassword: String) async throws {
        try await supabase.auth.update(user: UserAttributes(password: newPassword))
    }
}

// MARK: - Auth Errors

enum AuthError: LocalizedError {
    case signUpFailed
    case signInFailed
    case noSession
    case oauthFailed

    var errorDescription: String? {
        switch self {
        case .signUpFailed:
            return "Failed to create account"
        case .signInFailed:
            return "Failed to sign in"
        case .noSession:
            return "No active session"
        case .oauthFailed:
            return "OAuth authentication failed"
        }
    }
}

// MARK: - JSON Value Extension

extension AnyJSON {
    var stringValue: String? {
        switch self {
        case .string(let value):
            return value
        default:
            return nil
        }
    }
}
