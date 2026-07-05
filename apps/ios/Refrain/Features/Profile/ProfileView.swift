import SwiftUI

struct ProfileView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @Environment(AppState.self) private var appState

    @State private var isSigningOut = false
    @State private var isDeletingAccountData = false
    @State private var showDeleteAlert = false

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
    }

    private var displayName: String {
        appState.currentUser?.displayName ?? appState.currentUser?.email ?? "User"
    }

    private var email: String {
        appState.currentUser?.email ?? ""
    }

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(spacing: 0) {
                    headerView(topInset: proxy.safeAreaInsets.top)

                    VStack(spacing: 16) {
                        userInfoCard

                        SectionCard(title: "Account") {
                            ProfileRow(
                                label: "Sign out",
                                value: isSigningOut ? "Signing out..." : "Switch accounts or exit",
                                icon: "rectangle.portrait.and.arrow.right",
                                showChevron: false,
                                onPress: isSigningOut ? nil : handleSignOut
                            )
                        }

                        SectionCard(title: "Your data") {
                            ProfileRow(
                                label: "Delete account data",
                                value: isDeletingAccountData ? "Deleting..." : nil,
                                helper: "Permanently removes your lyrics, recordings, and projects",
                                icon: "trash",
                                destructive: true,
                                onPress: isDeletingAccountData ? nil : { showDeleteAlert = true }
                            )
                        }

                        SectionCard(title: "App") {
                            ProfileRow(
                                label: "Help / Support",
                                value: "jjm.bolland@gmail.com",
                                icon: "lifepreserver",
                                onPress: handleSupport
                            )

                            ProfileRow(
                                label: "Version",
                                value: "v\(appVersion)",
                                icon: "info.circle",
                                showChevron: false
                            )
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 32)
                }
            }
            .background(Theme.accentSoft)
        }
        .alert("Delete account", isPresented: $showDeleteAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive, action: handleDeleteAccountData)
        } message: {
            Text("This permanently deletes your lyrics, recordings, and projects from Refrain, then signs you out.")
        }
    }

    private func headerView(topInset: CGFloat) -> some View {
        HStack(spacing: 12) {
            AppBackButton {
                dismiss()
            }

            Spacer()
        }
        .padding(.top, topInset + 10)
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
    }

    private var userInfoCard: some View {
        HStack(alignment: .center, spacing: 12) {
            if let user = appState.currentUser {
                UserAvatar(user: user, size: 64)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(displayName)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Theme.ink)

                Text(email)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted.opacity(0.8))
            }

            Spacer()
        }
        .padding(16)
        .background(Theme.paper)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadiusLarge, style: .continuous)
                .stroke(Theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusLarge, style: .continuous))
    }

    private func handleSignOut() {
        Task {
            isSigningOut = true
            do {
                try await AuthService.shared.signOut()
                // AppState will automatically detect the auth state change
                // and update currentUser to nil, which will show LoginView
            } catch {
                // Show error alert
                print("Sign out error: \(error)")
            }
            isSigningOut = false
        }
    }

    private func handleSupport() {
        guard let emailURL = URL(string: "mailto:jjm.bolland@gmail.com") else {
            return
        }
        openURL(emailURL)
    }

    private func handleDeleteAccountData() {
        Task {
            isDeletingAccountData = true

            await appState.deleteCurrentAccountData()

            do {
                try await AuthService.shared.signOut()
            } catch {
                print("Delete account sign out error: \(error)")
            }

            isDeletingAccountData = false
        }
    }
}

struct SectionCard<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .textCase(.uppercase)
                .tracking(1.2)
                .foregroundStyle(Theme.muted)

            VStack(spacing: 0) {
                content()
            }
            .background(Theme.paper)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadiusLarge, style: .continuous)
                    .stroke(Theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusLarge, style: .continuous))
            .shadow(color: Color.black.opacity(0.04), radius: 10, x: 0, y: 4)
        }
    }
}

struct ProfileRow: View {
    let label: String
    var value: String? = nil
    var helper: String? = nil
    var icon: String = "person.circle"
    var showChevron: Bool = true
    var destructive: Bool = false
    var onPress: (() -> Void)? = nil

    var body: some View {
        Button {
            onPress?()
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Theme.accentSoft)
                        .frame(width: 40, height: 40)

                    Image(systemName: icon)
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(destructive ? Color.red : Theme.accentPressed)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(label)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(destructive ? Color.red : Theme.ink)

                    if let value = value {
                        Text(value)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.muted.opacity(0.8))
                    }

                    if let helper = helper {
                        Text(helper)
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.muted.opacity(0.7))
                    }
                }

                Spacer()

                if showChevron {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(destructive ? Color.red.opacity(0.6) : Color(hex: "9DACFF"))
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(ProfileRowButtonStyle())
        .disabled(onPress == nil)
    }
}

struct ProfileRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Theme.accentSoft.opacity(0.3) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .offset(y: configuration.isPressed ? 1 : 0)
    }
}

#Preview("Profile") {
    ProfileView()
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}
