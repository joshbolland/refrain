import Foundation
import SwiftUI
import AuthenticationServices

struct WebAuthenticationSession: Sendable {
    @MainActor
    func authenticate(
        using url: URL,
        callbackURLScheme: String
    ) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let contextProvider = WebAuthenticationPresentationContextProvider()
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: callbackURLScheme
            ) { callbackURL, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(
                        throwing: URLError(.unknown)
                    )
                }
            }

            session.presentationContextProvider = contextProvider
            session.start()
        }
    }
}

@MainActor
private final class WebAuthenticationPresentationContextProvider: NSObject, ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        ASPresentationAnchor()
    }
}

private struct WebAuthenticationSessionKey: EnvironmentKey {
    static let defaultValue = WebAuthenticationSession()
}

extension EnvironmentValues {
    var webAuthenticationSession: WebAuthenticationSession {
        get { self[WebAuthenticationSessionKey.self] }
        set { self[WebAuthenticationSessionKey.self] = newValue }
    }
}
