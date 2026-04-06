import SwiftUI

struct AuthBackground: View {
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Theme.canvas

                Image("RefrainAuthBackground")
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

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: Theme.cornerRadiusLarge, style: .continuous)
    }

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(20)
            .background(
                ZStack {
                    shape
                        .fill(.regularMaterial)
                        .environment(\.colorScheme, .light)

                    shape
                        .fill(Color.white.opacity(0.18))

                    shape
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.42),
                                    Color.white.opacity(0.14),
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                }
            )
            .overlay(
                shape
                    .strokeBorder(Color.white.opacity(0.55), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.08), radius: 22, y: 10)
    }
}

extension View {
    func authFieldStyle() -> some View {
        self
            .padding(.horizontal, 10)
            .padding(.vertical, 12)
            .background(
                ZStack {
                    RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                        .fill(.thinMaterial)
                        .environment(\.colorScheme, .light)

                    RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                        .fill(Color.white.opacity(0.2))

                    RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.3),
                                    Color.white.opacity(0.12),
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                    .stroke(Color.white.opacity(0.55), lineWidth: 1)
            )
    }
}
