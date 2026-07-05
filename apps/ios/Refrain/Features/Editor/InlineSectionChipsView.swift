import SwiftUI

/// Mode for the inline section picker
enum PickerMode {
    case new      // Adding a new section type
    case edit     // Editing an existing section type
}

/// Inline section type picker that appears above a line in the editor
struct InlineSectionChipsView: View {
    let mode: PickerMode
    let activeType: SectionType?
    let onSelect: (SectionType) -> Void
    let onDismiss: () -> Void

    @State private var opacity: Double = 0
    @State private var offsetX: CGFloat = 6

    /// Returns the section types to display based on mode
    /// In edit mode, excludes the currently active type
    private var displayedTypes: [SectionType] {
        switch mode {
        case .edit:
            guard let active = activeType else { return SectionType.allCases }
            return SectionType.allCases.filter { $0 != active }
        case .new:
            return SectionType.allCases
        }
    }

    var body: some View {
        scrollContent
            .opacity(opacity)
            .offset(x: offsetX)
            .onAppear {
                withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) {
                    opacity = 1
                    offsetX = 0
                }
            }
    }

    @ViewBuilder
    private var scrollContent: some View {
        if #available(iOS 26.0, *) {
            chipsScrollView
                .refrainSoftScrollEdges()
        } else {
            chipsScrollView
                .mask(trailingFadeMask)
        }
    }

    private var chipsScrollView: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(displayedTypes, id: \.self) { type in
                    InlineSectionChip(
                        sectionType: type,
                        isSelected: activeType == type,
                        action: {
                            onSelect(type)
                        }
                    )
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
        }
    }

    private var trailingFadeMask: some View {
        GeometryReader { proxy in
            let width = max(1, proxy.size.width)
            let trailingFadeStart = max(0, 1 - (fadeWidth / width))
            let leadingFadeEnd = min(1, fadeWidth / width)

            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0),
                    .init(color: .black, location: leadingFadeEnd),
                    .init(color: .black, location: trailingFadeStart),
                    .init(color: .clear, location: 1)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
        }
    }

    private var fadeWidth: CGFloat {
        22
    }
}

/// Individual chip for section type selection
struct InlineSectionChip: View {
    let sectionType: SectionType
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            SectionPillLabel(sectionType: sectionType)
        }
        .buttonStyle(PressableScaleStyle())
    }
}

#Preview("New Mode") {
    VStack {
        Spacer()
        InlineSectionChipsView(
            mode: .new,
            activeType: nil,
            onSelect: { _ in },
            onDismiss: {}
        )
        .padding()
        Spacer()
    }
    .background(Theme.canvas)
}

#Preview("Edit Mode") {
    VStack {
        Spacer()
        InlineSectionChipsView(
            mode: .edit,
            activeType: .chorus,
            onSelect: { _ in },
            onDismiss: {}
        )
        .padding()
        Spacer()
    }
    .background(Theme.canvas)
}
