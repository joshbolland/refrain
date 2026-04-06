import SwiftUI

struct AppBackButton: View {
    var title: String = "Back"
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 13, weight: .semibold))

                Text(title)
                    .font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(Theme.ink)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableScaleStyle(pressedOpacity: 0.72))
        .accessibilityLabel(title)
    }
}

#Preview {
    AppBackButton {}
        .padding()
        .background(Theme.headerBackground)
}
