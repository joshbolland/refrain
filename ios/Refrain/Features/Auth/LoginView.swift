import SwiftUI

struct LoginView: View {
    enum AuthMode {
        case signIn
        case signUp
    }

    @State private var mode: AuthMode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showSuccess = false

    @Environment(\.webAuthenticationSession) private var webAuthenticationSession

    private let authService = AuthService.shared

    private var canSignIn: Bool {
        !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !password.isEmpty
    }

    private var passwordsMatch: Bool {
        !password.isEmpty && password == confirmPassword
    }

    private var canSignUp: Bool {
        !email.isEmpty && !password.isEmpty && passwordsMatch && password.count >= 8
    }

    var body: some View {
        ZStack {
            AuthBackground()

            VStack(spacing: 0) {
                Spacer()

                VStack(alignment: .leading, spacing: 16) {
                    headerView
                    cardView
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
            }
        }
        .alert("Account Created", isPresented: $showSuccess) {
            Button("OK") {
                withAnimation(.easeInOut(duration: 0.25)) {
                    mode = .signIn
                }
            }
        } message: {
            Text("Please check your email to verify your account.")
        }
    }

    private var headerView: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(mode == .signIn ? "Welcome back" : "Create account")
                .font(.system(size: 11, weight: .semibold))
                .textCase(.uppercase)
                .tracking(2)
                .foregroundStyle(Color(hex: "4B5563"))

            Text(mode == .signIn ? "Sign in to Refrain" : "Join Refrain")
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(Theme.ink)

            Text(mode == .signIn
                 ? "Sign in with your password or continue with a provider to sync your lyrics across devices."
                 : "Use your email and a password to start saving your lyrics.")
                .font(.system(size: 14))
                .foregroundStyle(Color(hex: "3F3F46"))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var cardView: some View {
        AuthCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Email")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)

                TextField(
                    "",
                    text: $email,
                    prompt: Text("you@example.com").foregroundStyle(Theme.placeholder)
                )
                .textFieldStyle(.plain)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .tint(Theme.accent)
                .foregroundStyle(Theme.ink)
                .authFieldStyle()

                Text("Password")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)

                SecureField(
                    "",
                    text: $password,
                    prompt: Text("••••••••").foregroundStyle(Theme.placeholder)
                )
                .textFieldStyle(.plain)
                .textContentType(mode == .signIn ? .password : .newPassword)
                .tint(Theme.accent)
                .foregroundStyle(Theme.ink)
                .authFieldStyle()

                if mode == .signUp {
                    Text("Confirm password")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.ink)

                    SecureField(
                        "",
                        text: $confirmPassword,
                        prompt: Text("••••••••").foregroundStyle(Theme.placeholder)
                    )
                    .textFieldStyle(.plain)
                    .textContentType(.newPassword)
                    .tint(Theme.accent)
                    .foregroundStyle(Theme.ink)
                    .authFieldStyle()

                    if password.count > 0 && password.count < 8 {
                        Text("Password must be at least 8 characters")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.orange)
                    }

                    if !confirmPassword.isEmpty && !passwordsMatch {
                        Text("Passwords do not match")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.red)
                    }
                }

                if let error = errorMessage {
                    Text(error)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                }

                Button {
                    Task {
                        if mode == .signIn {
                            await signIn()
                        } else {
                            await signUp()
                        }
                    }
                } label: {
                    Text(buttonLabel)
                        .frame(maxWidth: .infinity)
                }
                .primaryButtonStyle()
                .buttonStyle(PressableScaleStyle())
                .disabled(isLoading || (mode == .signIn ? !canSignIn : !canSignUp))
                .opacity(isLoading || (mode == .signIn ? !canSignIn : !canSignUp) ? 0.6 : 1)

                Button {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        mode = mode == .signIn ? .signUp : .signIn
                        errorMessage = nil
                        confirmPassword = ""
                    }
                } label: {
                    Text(mode == .signIn ? "Don't have an account? Sign up" : "Already have an account? Sign in")
                        .font(.system(size: 11, weight: .semibold))
                        .textCase(.uppercase)
                        .tracking(1.4)
                        .foregroundStyle(Theme.muted)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PressableScaleStyle(pressedOpacity: 0.7))

                HStack(spacing: 8) {
                    Rectangle()
                        .fill(Color.white.opacity(0.7))
                        .frame(height: 1)

                    Text("or")
                        .font(.system(size: 11, weight: .semibold))
                        .textCase(.uppercase)
                        .tracking(1.2)
                        .foregroundStyle(Color(hex: "4B5563"))
                        .fixedSize()

                    Rectangle()
                        .fill(Color.white.opacity(0.7))
                        .frame(height: 1)
                }

                HStack(spacing: 10) {
                    Button {
                        Task { await signInWithGoogle() }
                    } label: {
                        Text("Google")
                            .frame(maxWidth: .infinity)
                    }
                    .secondaryButtonStyle()
                    .buttonStyle(PressableScaleStyle())
                    .disabled(isLoading)

                    Button {
                        Task { await signInWithApple() }
                    } label: {
                        Text("Apple")
                            .frame(maxWidth: .infinity)
                    }
                    .secondaryButtonStyle()
                    .buttonStyle(PressableScaleStyle())
                    .disabled(isLoading)
                }

                if isLoading {
                    HStack {
                        Spacer()
                        ProgressView()
                            .tint(Theme.accent)
                        Spacer()
                    }
                    .padding(.top, 4)
                }
            }
        }
    }

    private var buttonLabel: String {
        if isLoading {
            return mode == .signIn ? "Signing in..." : "Creating account..."
        }
        return mode == .signIn ? "Sign in" : "Create account"
    }

    private func signIn() async {
        isLoading = true
        errorMessage = nil

        do {
            _ = try await authService.signIn(email: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private func signUp() async {
        isLoading = true
        errorMessage = nil

        do {
            _ = try await authService.signUp(email: email, password: password)
            showSuccess = true
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private func signInWithGoogle() async {
        isLoading = true
        errorMessage = nil

        do {
            _ = try await authService.signInWithGoogle { url in
                try await webAuthenticationSession.authenticate(
                    using: url,
                    callbackURLScheme: Config.oauthCallbackScheme
                )
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private func signInWithApple() async {
        isLoading = true
        errorMessage = nil

        do {
            _ = try await authService.signInWithApple { url in
                try await webAuthenticationSession.authenticate(
                    using: url,
                    callbackURLScheme: Config.oauthCallbackScheme
                )
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

#Preview {
    LoginView()
}
