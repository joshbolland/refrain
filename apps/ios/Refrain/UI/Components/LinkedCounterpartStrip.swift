import SwiftUI

struct LinkedCounterpartStrip: View {
    let items: [LibraryItem]
    let onSelect: (LibraryItem) -> Void

    var body: some View {
        if !items.isEmpty {
            if items.count == 1, let item = items.first {
                Button {
                    onSelect(item)
                } label: {
                    controlLabel(iconName: item.linkedIconName)
                }
                .buttonStyle(PressableScaleStyle())
                .accessibilityLabel("Open \(item.linkedTypeLabel.lowercased()) \(item.displayTitle)")
            } else {
                Menu {
                    ForEach(items, id: \.id) { item in
                        Button {
                            onSelect(item)
                        } label: {
                            Label(item.displayTitle, systemImage: item.linkedIconName)
                        }
                    }
                } label: {
                    controlLabel(iconName: "link", count: items.count)
                }
                .buttonStyle(PressableScaleStyle())
                .accessibilityLabel("\(items.count) linked items")
            }
        }
    }

    private func controlLabel(
        iconName: String,
        count: Int? = nil
    ) -> some View {
        ZStack(alignment: .topTrailing) {
            Image(systemName: iconName)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.accentPressed)
                .frame(width: 34, height: 34)
                .background(Theme.accentSoft)
                .overlay(
                    Circle()
                        .stroke(Theme.accent.opacity(0.28), lineWidth: 1)
                )
                .clipShape(Circle())

            if let count {
                Text(count > 9 ? "9+" : "\(count)")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Theme.paper)
                    .frame(minWidth: 16, minHeight: 16)
                    .background(Theme.accentPressed)
                    .clipShape(Capsule())
                    .offset(x: 5, y: -5)
            }
        }
        .frame(width: 40, height: 40)
        .contentShape(Rectangle())
    }
}

private extension LibraryItem {
    var displayTitle: String {
        title.isEmpty ? "Untitled" : title
    }

    var linkedIconName: String {
        isLyric ? "music.note" : "waveform"
    }

    var linkedTypeLabel: String {
        isLyric ? "Linked lyric" : "Linked recording"
    }
}

#Preview("Linked Counterparts") {
    HStack(spacing: 16) {
        LinkedCounterpartStrip(
            items: [
                .recording(Recording(title: "Chorus take", durationMs: 24_000))
            ],
            onSelect: { _ in }
        )

        LinkedCounterpartStrip(
            items: [
                .lyric(LyricFile(title: "Midnight Drive")),
                .recording(Recording(title: "Chorus take", durationMs: 24_000))
            ],
            onSelect: { _ in }
        )
    }
    .padding(20)
    .background(Theme.paper)
}
