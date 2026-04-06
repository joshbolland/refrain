import SwiftUI
import UIKit
import Combine

/// Observes keyboard visibility and height changes
@Observable
final class KeyboardObserver {
    var isVisible = false
    var height: CGFloat = 0

    private var cancellables = Set<AnyCancellable>()

    init() {
        setupKeyboardObservers()
    }

    private func setupKeyboardObservers() {
        NotificationCenter.default.publisher(for: UIResponder.keyboardWillChangeFrameNotification)
            .sink { [weak self] notification in
                self?.handleKeyboardFrameChange(notification)
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)
            .sink { [weak self] notification in
                self?.handleKeyboardFrameChange(notification)
            }
            .store(in: &cancellables)
    }

    private func handleKeyboardFrameChange(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let keyboardFrame = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else {
            return
        }

        let visibleHeight = max(0, UIScreen.main.bounds.maxY - keyboardFrame.minY)
        let animationDuration =
            (userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double) ?? 0.25

        withAnimation(.easeOut(duration: animationDuration)) {
            isVisible = visibleHeight > 0
            height = visibleHeight
        }
    }
}

// MARK: - Environment Key

private struct KeyboardObserverKey: EnvironmentKey {
    static let defaultValue = KeyboardObserver()
}

extension EnvironmentValues {
    var keyboardObserver: KeyboardObserver {
        get { self[KeyboardObserverKey.self] }
        set { self[KeyboardObserverKey.self] = newValue }
    }
}
