import SwiftUI

enum SaveStatus {
    case saved
    case saving
    case unsaved
    case error(String)

    var icon: String {
        switch self {
        case .saved: return "checkmark.circle.fill"
        case .saving: return "arrow.triangle.2.circlepath"
        case .unsaved: return "circle"
        case .error: return "exclamationmark.circle.fill"
        }
    }

    var color: Color {
        switch self {
        case .saved: return .green
        case .saving: return .blue
        case .unsaved: return .secondary
        case .error: return .red
        }
    }

    var text: String {
        switch self {
        case .saved: return "Saved"
        case .saving: return "Saving..."
        case .unsaved: return "Unsaved"
        case .error(let message): return message
        }
    }
}

struct SaveStatusIndicator: View {
    let status: SaveStatus

    /// Duration to show "Saved" status before hiding (React Native: 1.5s)
    private let autoHideDuration: TimeInterval = 1.5

    @State private var isAnimating = false
    @State private var isVisible = true
    @State private var hideTask: Task<Void, Never>?

    var body: some View {
        Group {
            if isVisible {
                HStack(spacing: 4) {
                    Image(systemName: status.icon)
                        .foregroundStyle(status.color)
                        .rotationEffect(isAnimating && status == .saving ? .degrees(360) : .degrees(0))
                        .animation(
                            status == .saving
                                ? .linear(duration: 1).repeatForever(autoreverses: false)
                                : .default,
                            value: isAnimating
                        )

                    Text(status.text)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: isVisible)
        .onAppear {
            if case .saving = status {
                isAnimating = true
            }
            scheduleAutoHide()
        }
        .onChange(of: status == .saving) { _, isSaving in
            isAnimating = isSaving
        }
        .onChange(of: status == .saved) { oldValue, newValue in
            // When status changes to saved, show and schedule hide
            if newValue && !oldValue {
                isVisible = true
                scheduleAutoHide()
            } else if !newValue {
                // If status changes away from saved, cancel hide and show
                hideTask?.cancel()
                isVisible = true
            }
        }
    }

    private func scheduleAutoHide() {
        hideTask?.cancel()

        // Only auto-hide for "saved" status
        guard case .saved = status else { return }

        hideTask = Task {
            try? await Task.sleep(for: .seconds(autoHideDuration))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                isVisible = false
            }
        }
    }
}

private func == (lhs: SaveStatus, rhs: SaveStatus) -> Bool {
    switch (lhs, rhs) {
    case (.saved, .saved), (.saving, .saving), (.unsaved, .unsaved):
        return true
    case (.error(let a), .error(let b)):
        return a == b
    default:
        return false
    }
}

#Preview {
    VStack(spacing: 16) {
        SaveStatusIndicator(status: .saved)
        SaveStatusIndicator(status: .saving)
        SaveStatusIndicator(status: .unsaved)
        SaveStatusIndicator(status: .error("Failed to save"))
    }
    .padding()
}
