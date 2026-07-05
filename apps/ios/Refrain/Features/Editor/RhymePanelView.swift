import SwiftUI
import UIKit

struct RhymeAccessoryStrip: View {
    let currentWord: String?
    let rhymes: [String]
    let onSelectRhyme: (String) -> Void

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "music.note")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Theme.accentPressed)

                if let currentWord, !currentWord.isEmpty {
                    Text("Rhymes for \(currentWord)")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                } else {
                    Text("Move to a line ending for rhymes")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Theme.muted.opacity(0.75))
                        .lineLimit(1)
                }

                Spacer(minLength: 0)
            }

            if rhymes.isEmpty {
                HStack(spacing: 8) {
                    Text(currentWord == nil ? "No active rhyme word" : "No rhymes found")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.muted.opacity(0.7))

                    Spacer(minLength: 0)
                }
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(rhymes, id: \.self) { rhyme in
                            Button {
                                onSelectRhyme(rhyme)
                            } label: {
                                Text(rhyme)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Theme.accentPressed)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(Theme.accentSoft)
                                    .overlay(
                                        Capsule()
                                            .stroke(Theme.accent.opacity(0.5), lineWidth: 1)
                                    )
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 1)
                }
                .refrainSoftScrollEdges()
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, 10)
        .padding(.bottom, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemBackground))
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.divider.opacity(0.9))
                .frame(height: 1)
        }
    }
}

final class RhymeAccessoryInputView: UIInputView {
    private let hostingController = UIHostingController(
        rootView: RhymeAccessoryStrip(currentWord: nil, rhymes: [], onSelectRhyme: { _ in })
    )

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: 78)
    }

    init() {
        super.init(frame: .zero, inputViewStyle: .keyboard)
        allowsSelfSizing = false
        autoresizingMask = [.flexibleHeight]
        backgroundColor = .clear

        let hostedView = hostingController.view!
        hostedView.backgroundColor = .clear
        hostedView.translatesAutoresizingMaskIntoConstraints = false

        addSubview(hostedView)

        NSLayoutConstraint.activate([
            hostedView.topAnchor.constraint(equalTo: topAnchor),
            hostedView.leadingAnchor.constraint(equalTo: leadingAnchor),
            hostedView.trailingAnchor.constraint(equalTo: trailingAnchor),
            hostedView.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func update(
        currentWord: String?,
        rhymes: [String],
        onSelectRhyme: @escaping (String) -> Void
    ) {
        hostingController.rootView = RhymeAccessoryStrip(
            currentWord: currentWord,
            rhymes: rhymes,
            onSelectRhyme: onSelectRhyme
        )
    }
}

#Preview {
    RhymeAccessoryStrip(
        currentWord: "time",
        rhymes: ["rhyme", "climb", "prime", "chime", "sublime"],
        onSelectRhyme: { _ in }
    )
    .frame(height: 78)
}
