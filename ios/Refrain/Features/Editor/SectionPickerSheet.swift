import SwiftUI

struct SectionPickerSheet: View {
    let currentType: SectionType?
    let onSelect: (SectionType) -> Void
    let onRepeatChorus: () -> Void

    @Environment(\.dismiss) private var dismiss

    private let mainTypes: [SectionType] = [.verse, .chorus, .bridge, .preChorus]
    private let otherTypes: [SectionType] = [.intro, .outro, .other]

    var body: some View {
        VStack(spacing: 16) {
            // Handle bar
            Capsule()
                .fill(.secondary.opacity(0.3))
                .frame(width: 36, height: 5)
                .padding(.top, 8)

            Text("Section Type")
                .font(.headline)

            // Main section types
            HStack(spacing: 8) {
                ForEach(mainTypes, id: \.self) { type in
                    SectionTypeButton(
                        type: type,
                        isSelected: currentType == type
                    ) {
                        onSelect(type)
                    }
                }
            }

            // Other types
            HStack(spacing: 8) {
                ForEach(otherTypes, id: \.self) { type in
                    SectionTypeButton(
                        type: type,
                        isSelected: currentType == type
                    ) {
                        onSelect(type)
                    }
                }

                // Repeat chorus button
                Button {
                    onRepeatChorus()
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "repeat")
                        Text("Repeat")
                    }
                    .font(.subheadline)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.purple.opacity(0.8))
                    .clipShape(Capsule())
                }
            }

            Spacer()
        }
        .padding(.horizontal)
    }
}

struct SectionTypeButton: View {
    let type: SectionType
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(type.displayName)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(isSelected ? .white : Theme.sectionColor(for: type))
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(
                    isSelected
                        ? Theme.sectionColor(for: type)
                        : Theme.sectionColor(for: type).opacity(0.15)
                )
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    SectionPickerSheet(
        currentType: .verse,
        onSelect: { _ in },
        onRepeatChorus: { }
    )
}
