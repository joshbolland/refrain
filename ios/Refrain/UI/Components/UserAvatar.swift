import SwiftUI

struct UserAvatar: View {
    let user: User?
    var size: CGFloat = 36

    var body: some View {
        ZStack {
            Circle()
                .fill(Theme.paper)
                .overlay(
                    Circle()
                        .stroke(Theme.divider, lineWidth: 1)
                )

            if let urlString = user?.avatarUrl, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure, .empty:
                        initialsView
                    @unknown default:
                        initialsView
                    }
                }
                .clipShape(Circle())
            } else {
                initialsView
            }
        }
        .frame(width: size, height: size)
    }

    private var initialsView: some View {
        Text(user?.initials ?? "??")
            .font(.system(size: size * 0.32, weight: .semibold))
            .foregroundStyle(Theme.ink)
    }
}

#Preview {
    UserAvatar(user: User(id: "1", email: "demo@refrain.app", displayName: "Ava Carter", avatarUrl: nil))
}
