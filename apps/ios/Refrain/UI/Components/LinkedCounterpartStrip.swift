import SwiftUI

struct LinkedCounterpartStrip: View {
    let items: [LibraryItem]
    let onSelect: (LibraryItem) -> Void

    var body: some View {
        if !items.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(items, id: \.id) { item in
                        Button {
                            onSelect(item)
                        } label: {
                            HStack(spacing: 7) {
                                Image(systemName: "link")
                                    .font(.system(size: 11, weight: .semibold))

                                Image(systemName: item.isLyric ? "music.note" : "waveform")
                                    .font(.system(size: 12, weight: .semibold))

                                Text(item.title.isEmpty ? "Untitled" : item.title)
                                    .font(.system(size: 12, weight: .semibold))
                                    .lineLimit(1)
                            }
                            .foregroundStyle(Theme.accentPressed)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(Theme.accentSoft)
                            .overlay(
                                Capsule()
                                    .stroke(Theme.accent.opacity(0.35), lineWidth: 1)
                            )
                            .clipShape(Capsule())
                        }
                        .buttonStyle(PressableScaleStyle())
                    }
                }
                .padding(.horizontal, 20)
            }
        }
    }
}

#Preview("Linked Counterparts") {
    LinkedCounterpartStrip(
        items: [
            .lyric(LyricFile(title: "Midnight Drive")),
            .recording(Recording(title: "Chorus take", durationMs: 24_000))
        ],
        onSelect: { _ in }
    )
    .padding(.vertical, 20)
    .background(Theme.paper)
}
