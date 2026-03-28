import SwiftUI

struct AuthBackground: View {
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Theme.canvas

                Image("Splash")
                    .resizable()
                    .scaledToFill()
                    .frame(width: geometry.size.width, height: geometry.size.height)
                    .clipped()
                    .blur(radius: 4)

                LinearGradient(
                    colors: [
                        Color.white.opacity(0.0),
                        Color.white.opacity(0.35),
                        Color.white.opacity(0.2),
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
        }
        .ignoresSafeArea()
    }
}

struct AuthCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(14)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: Theme.cornerRadiusLarge, style: .continuous)
                        .fill(.ultraThinMaterial)

                    RoundedRectangle(cornerRadius: Theme.cornerRadiusLarge, style: .continuous)
                        .fill(Color.white.opacity(0.38))

                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.0),
                            Color.white.opacity(0.55),
                            Color.white.opacity(0.35),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusLarge, style: .continuous))
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusLarge, style: .continuous))
    }
}

extension View {
    func authFieldStyle() -> some View {
        self
            .padding(.horizontal, 10)
            .padding(.vertical, 12)
            .background(Color.white.opacity(0.72))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                    .stroke(Color.white.opacity(0.75), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
    }
}
