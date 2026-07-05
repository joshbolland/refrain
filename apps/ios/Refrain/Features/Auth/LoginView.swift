import SwiftUI

struct LoginView: View {
    enum AuthMode {
        case signIn
        case signUp
    }

    private enum Field: Hashable {
        case email
        case password
        case confirmPassword
    }

    @State private var mode: AuthMode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showSuccess = false
    @FocusState private var focusedField: Field?

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

    private var headerSpacing: CGFloat {
        mode == .signUp ? 6 : 10
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                AuthBackground()

                VStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 16) {
                        headerView(heroHeight: heroHeight(for: geometry))
                        cardView
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, topPadding(for: geometry))
                    .padding(.bottom, 20)

                    Spacer(minLength: 0)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                focusedField = nil
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

    private func headerView(heroHeight: CGFloat) -> some View {
        let clampedHeroHeight = heroHeight.isFinite ? max(heroHeight, 1) : 1
        return VStack(spacing: headerSpacing) {
            Image("RefrainBird")
                .resizable()
                .scaledToFit()
                .frame(height: clampedHeroHeight * 0.94)
                .frame(
                    maxWidth: .infinity,
                    minHeight: clampedHeroHeight,
                    maxHeight: clampedHeroHeight,
                    alignment: .top
                )
                .offset(x: 12)
                .padding(.bottom, 10)

            Text(mode == .signIn ? "Welcome back" : "Create account")
                .font(.system(size: 11, weight: .semibold))
                .textCase(.uppercase)
                .tracking(2)
                .foregroundStyle(Color(hex: "4B5563"))
                .frame(maxWidth: .infinity)

            Text(mode == .signIn ? "Sign in to Refrain" : "Join Refrain")
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(Theme.headerTitle)
                .frame(maxWidth: .infinity)

            Text(mode == .signIn
                 ? "Sign in to keep your lyrics in sync."
                 : "Create an account to save your lyrics.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.headerSubtitle)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func heroHeight(for geometry: GeometryProxy) -> CGFloat {
        let availableHeight = max(
            geometry.size.height - geometry.safeAreaInsets.top - geometry.safeAreaInsets.bottom,
            0
        )

        if mode == .signUp {
            return min(availableHeight * 0.2, 180)
        }

        return min(availableHeight * 0.3, 240)
    }

    private func topPadding(for geometry: GeometryProxy) -> CGFloat {
        let safeAreaTop = geometry.safeAreaInsets.top
        return safeAreaTop > 0 ? safeAreaTop : 16
    }

    private var cardView: some View {
        AuthCard {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Theme.ink)

                        TextField(
                            "",
                            text: $email,
                            prompt: Text("you@example.com").foregroundColor(.gray)
                        )
                        .textFieldStyle(.plain)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .foregroundColor(Theme.ink)
                        .focused($focusedField, equals: .email)
                        .submitLabel(.next)
                        .onSubmit {
                            focusedField = .password
                        }
                        .authFieldStyle()
                    }

                    VStack(alignment: .leading, spacing: 6) {
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
                        .focused($focusedField, equals: .password)
                        .submitLabel(mode == .signIn ? .done : .next)
                        .onSubmit {
                            if mode == .signIn {
                                focusedField = nil
                            } else {
                                focusedField = .confirmPassword
                            }
                        }
                        .authFieldStyle()
                    }

                    if mode == .signUp {
                        VStack(alignment: .leading, spacing: 6) {
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
                            .focused($focusedField, equals: .confirmPassword)
                            .submitLabel(.done)
                            .onSubmit {
                                focusedField = nil
                            }
                            .authFieldStyle()
                        }

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
                .padding(.top, 4)

                HStack(spacing: 10) {
                    Button {
                        Task { await signInWithGoogle() }
                    } label: {
                        authProviderLabel(
                            title: "Google",
                            icon: {
                                Image("GoogleG")
                                    .resizable()
                                    .scaledToFit()
                                    .frame(width: 18, height: 18)
                            }
                        )
                    }
                    .secondaryButtonStyle()
                    .buttonStyle(PressableScaleStyle())
                    .disabled(isLoading)

                    Button {
                        Task { await signInWithApple() }
                    } label: {
                        authProviderLabel(
                            title: "Apple",
                            icon: {
                                Image(systemName: "applelogo")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(Theme.ink)
                                    .frame(width: 18, height: 18)
                            }
                        )
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

    private func authProviderLabel<Icon: View>(
        title: String,
        @ViewBuilder icon: () -> Icon
    ) -> some View {
        HStack(spacing: 8) {
            icon()

            Text(title)
        }
        .frame(maxWidth: .infinity)
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
