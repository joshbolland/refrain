import SwiftUI

struct SectionBadge: View {
    let sectionType: SectionType

    private var accentColor: Color {
        Theme.sectionColor(for: sectionType)
    }

    var body: some View {
        Text(sectionType.shortName)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(.white)
            .frame(width: 24, height: 24)
            .background(accentColor)
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
    }
}

struct SectionChip: View {
    let sectionType: SectionType
    let isSelected: Bool
    let action: () -> Void

    private var accentColor: Color {
        Theme.sectionColor(for: sectionType)
    }

    private var tintColor: Color {
        Theme.sectionTintColor(for: sectionType)
    }

    var body: some View {
        Button(action: action) {
            Text(sectionType.displayName)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(isSelected ? .white : accentColor)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? accentColor : tintColor)
                .clipShape(Capsule())
        }
        .buttonStyle(PressableScaleStyle())
    }
}

struct SectionChipsRow: View {
    @Binding var selectedType: SectionType?
    let onSelect: (SectionType) -> Void

    private let mainTypes: [SectionType] = [.verse, .chorus, .bridge, .preChorus]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(mainTypes, id: \.self) { type in
                    SectionChip(
                        sectionType: type,
                        isSelected: selectedType == type
                    ) {
                        selectedType = type
                        onSelect(type)
                    }
                }
            }
            .padding(.horizontal, Theme.paddingMedium)
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        HStack(spacing: 8) {
            ForEach(SectionType.allCases, id: \.self) { type in
                SectionBadge(sectionType: type)
            }
        }

        SectionChipsRow(selectedType: .constant(.verse)) { _ in }
    }
    .padding()
}
