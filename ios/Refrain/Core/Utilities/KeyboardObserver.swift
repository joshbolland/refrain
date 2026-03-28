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
        NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)
            .sink { [weak self] notification in
                self?.handleKeyboardWillShow(notification)
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)
            .sink { [weak self] _ in
                self?.handleKeyboardWillHide()
            }
            .store(in: &cancellables)
    }

    private func handleKeyboardWillShow(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let keyboardFrame = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else {
            return
        }

        withAnimation(.easeOut(duration: 0.25)) {
            isVisible = true
            height = keyboardFrame.height
        }
    }

    private func handleKeyboardWillHide() {
        withAnimation(.easeOut(duration: 0.25)) {
            isVisible = false
            height = 0
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
