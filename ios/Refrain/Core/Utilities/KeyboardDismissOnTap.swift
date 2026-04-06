import SwiftUI
import UIKit

struct KeyboardDismissOnTapModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.background(KeyboardDismissTapInstaller())
    }
}

extension View {
    func dismissKeyboardOnTap() -> some View {
        modifier(KeyboardDismissOnTapModifier())
    }
}

private struct KeyboardDismissTapInstaller: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)
        view.isUserInteractionEnabled = false
        context.coordinator.attachIfNeeded(from: view)
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        context.coordinator.attachIfNeeded(from: uiView)
    }

    static func dismantleUIView(_ uiView: UIView, coordinator: Coordinator) {
        coordinator.detach()
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        private weak var window: UIWindow?
        private weak var tapGestureRecognizer: UITapGestureRecognizer?

        func attachIfNeeded(from view: UIView) {
            DispatchQueue.main.async { [weak self, weak view] in
                guard
                    let self,
                    let view,
                    let window = view.window
                else {
                    return
                }

                guard self.window !== window || self.tapGestureRecognizer == nil else {
                    return
                }

                detach()

                let recognizer = UITapGestureRecognizer(
                    target: self,
                    action: #selector(handleWindowTap)
                )
                recognizer.cancelsTouchesInView = false
                recognizer.delegate = self
                window.addGestureRecognizer(recognizer)

                self.window = window
                self.tapGestureRecognizer = recognizer
            }
        }

        func detach() {
            if let tapGestureRecognizer {
                window?.removeGestureRecognizer(tapGestureRecognizer)
            }

            tapGestureRecognizer = nil
            window = nil
        }

        @objc
        private func handleWindowTap() {
            window?.endEditing(true)
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            guard let touchedView = touch.view else {
                return true
            }

            return !touchedView.isDescendantOfEditableInput
        }
    }
}

private extension UIView {
    var isDescendantOfEditableInput: Bool {
        sequence(first: self, next: \.superview).contains { view in
            if let textView = view as? UITextView {
                return textView.isEditable
            }

            return view is UITextField || view is UISearchBar
        }
    }
}
