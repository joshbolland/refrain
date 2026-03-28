import Foundation
import Supabase

final class SupabaseService: Sendable {
    static let shared = SupabaseService()

    let client: SupabaseClient

    private init() {
        // These should be configured via environment or Config file
        let supabaseUrl = URL(string: Config.supabaseUrl)!
        let supabaseKey = Config.supabaseAnonKey

        client = SupabaseClient(
            supabaseURL: supabaseUrl,
            supabaseKey: supabaseKey,
            options: SupabaseClientOptions(
                auth: SupabaseClientOptions.AuthOptions(
                    redirectToURL: URL(string: Config.oauthCallbackUrl),
                    emitLocalSessionAsInitialSession: true
                )
            )
        )
    }
}

// MARK: - Configuration

enum Config {
    // TODO: Replace with actual values from environment
    static let supabaseUrl = "https://zagkrkugmwuqnheyvybm.supabase.co"
    static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZ2tya3VnbXd1cW5oZXl2eWJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMDgwMTcsImV4cCI6MjA4MTg4NDAxN30.WlDR_QOR79yAjr_eSRifaXn7La0ANHGy64Bin5kJzUg"

    // OAuth callback URL scheme
    static let oauthCallbackScheme = "refrain"
    static let oauthCallbackUrl = "\(oauthCallbackScheme)://auth/callback"
}
