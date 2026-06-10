import SwiftUI
import UIKit

/// Custom text editor with line numbers and section labels
struct LyricTextEditor: View {
    @Binding var text: String
    let sectionTypes: [Int: SectionType]
    let parsedLines: [ParsedLine]
    let currentWord: String?
    let keyboardInset: CGFloat
    let showsRhymeSuggestions: Bool
    let onSectionBadgeTap: (Int) -> Void
    let onCursorChange: ((Int, String?) -> Void)?

    // Inline picker state
    let pickerLineIndex: Int?
    let pickerMode: PickerMode
    let onPickerSelect: (SectionType) -> Void
    let onPickerDismiss: () -> Void

    @State private var lineHeights: [Int: CGFloat] = [:]
    @State private var scrollOffset: CGFloat = 0
    @State private var viewportHeight: CGFloat = 0

    private let lineHeight: CGFloat = Theme.editorLineHeight
    private let fontSize: CGFloat = Theme.editorFontSize

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .topLeading) {
                HStack(alignment: .top, spacing: 0) {
                    // Line numbers gutter
                    LineNumbersGutter(
                        bodyText: text,
                        lineHeights: lineHeights,
                        scrollOffset: scrollOffset,
                        onTap: pickerLineIndex == nil ? nil : onPickerDismiss
                    )
                    .frame(width: Theme.lineNumberWidth)
                    .frame(maxHeight: .infinity, alignment: .top)

                    ZStack(alignment: .topLeading) {
                        // Main text editor
                        LyricTextViewRepresentable(
                            text: $text,
                            sectionTypes: sectionTypes,
                            lineHeights: lineHeights,
                            lineHeight: lineHeight,
                            fontSize: fontSize,
                            currentWord: currentWord,
                            keyboardInset: keyboardInset,
                            showsRhymeSuggestions: showsRhymeSuggestions,
                            onLineHeightsChange: { heights in
                                lineHeights = heights
                            },
                            onScroll: { offset in
                                scrollOffset = offset
                            },
                            onSectionBadgeTap: onSectionBadgeTap,
                            onCursorChange: onCursorChange,
                            onTap: pickerLineIndex == nil ? nil : onPickerDismiss
                        )
                        .equatable()
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

                        SectionPillsOverlay(
                            text: text,
                            sectionTypes: sectionTypes,
                            lineHeights: lineHeights,
                            scrollOffset: scrollOffset,
                            viewportHeight: viewportHeight,
                            onBadgeTap: onSectionBadgeTap
                        )
                        .padding(.leading, Theme.editorHorizontalPadding)
                        .allowsHitTesting(false)

                        SectionPillTapOverlay(
                            text: text,
                            sectionTypes: sectionTypes,
                            lineHeights: lineHeights,
                            scrollOffset: scrollOffset,
                            viewportHeight: viewportHeight,
                            onBadgeTap: onSectionBadgeTap
                        )
                        .padding(.leading, Theme.editorHorizontalPadding)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
                .frame(width: geometry.size.width, height: geometry.size.height, alignment: .topLeading)

                // Inline section picker overlay
                if let pickerLine = pickerLineIndex {
                    let yOffset = inlinePickerYOffset(for: pickerLine, bodyText: text)
                    let xOffset = inlinePickerXOffset(
                        for: pickerLine,
                        bodyText: text,
                        containerWidth: geometry.size.width
                    )
                    let availableWidth = max(
                        0, geometry.size.width - xOffset - inlinePickerTrailingInset)
                    InlineSectionChipsView(
                        mode: pickerMode,
                        activeType: sectionTypes[pickerLine],
                        onSelect: onPickerSelect,
                        onDismiss: onPickerDismiss
                    )
                    .id(inlinePickerIdentity(for: pickerLine))
                    .frame(width: availableWidth, alignment: .leading)
                    .offset(
                        x: xOffset,
                        y: yOffset
                    )
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height, alignment: .topLeading)
            .clipped()
            .onAppear {
                viewportHeight = geometry.size.height
            }
            .onChange(of: geometry.size.height) { _, newHeight in
                viewportHeight = newHeight
            }
        }
    }

    /// Calculate the Y offset for the inline picker above a line
    private func calculatePickerYOffset(for lineIndex: Int) -> CGFloat {
        var offset: CGFloat = Theme.editorPaddingTop
        for i in 0..<lineIndex {
            offset += lineHeights[i] ?? lineHeight
        }
        return offset
    }

    private func inlinePickerYOffset(for lineIndex: Int, bodyText: String) -> CGFloat {
        let baseOffset = calculatePickerYOffset(for: lineIndex) - scrollOffset - 44
        guard pickerMode == .edit else { return baseOffset + inlinePickerNewModeVerticalAdjustment }

        let lines = bodyText.components(separatedBy: "\n")
        let labelOffset = sectionLabelOffset(for: lineIndex, lines: lines)
        let pillOffset = calculatePickerYOffset(for: lineIndex) - scrollOffset - labelOffset
        return pillOffset - inlinePickerVerticalPadding + inlinePickerVerticalAdjustment
    }

    private func inlinePickerXOffset(for lineIndex: Int, bodyText: String, containerWidth: CGFloat)
        -> CGFloat
    {
        let baseX = Theme.lineNumberWidth + Theme.editorHorizontalPadding
        let validStarts = SectionAnalyzer.getValidSectionStartSet(body: bodyText)

        guard let sectionType = sectionTypes[lineIndex], validStarts.contains(lineIndex) else {
            return baseX + inlinePickerNewModeHorizontalAdjustment
        }

        let pillWidth = sectionPillWidth(for: sectionType)
        let desiredX = baseX + pillWidth + 8 + inlinePickerHorizontalAdjustment
        let maxX = max(baseX, containerWidth - inlinePickerTrailingInset - inlinePickerMinWidth)
        return min(desiredX, maxX)
    }

    private func sectionPillWidth(for type: SectionType) -> CGFloat {
        let text = type.displayName.uppercased()
        let font = UIFont.systemFont(ofSize: 11, weight: .semibold)
        let baseWidth = (text as NSString).size(withAttributes: [.font: font]).width
        let tracking: CGFloat = 2
        let extraTracking = tracking * CGFloat(max(0, text.count - 1))
        return baseWidth + extraTracking + 24
    }

    private func sectionLabelOffset(for lineIndex: Int, lines: [String]) -> CGFloat {
        let lift = Theme.editorLineHeight * 0.75
        guard lineIndex > 0, lineIndex - 1 < lines.count else {
            return lift
        }
        if SectionAnalyzer.isBlankLine(lines[lineIndex - 1]) {
            return lift
        }
        return Theme.editorLineHeight * 0.6
    }

    private var inlinePickerVerticalPadding: CGFloat {
        6
    }

    private var inlinePickerTrailingInset: CGFloat {
        0
    }

    private var inlinePickerMinWidth: CGFloat {
        180
    }

    private var inlinePickerVerticalAdjustment: CGFloat {
        0
    }

    private var inlinePickerHorizontalAdjustment: CGFloat {
        -4
    }

    private var inlinePickerNewModeVerticalAdjustment: CGFloat {
        18
    }

    private var inlinePickerNewModeHorizontalAdjustment: CGFloat {
        -16
    }

    private func inlinePickerIdentity(for lineIndex: Int) -> String {
        let activeType = sectionTypes[lineIndex]?.displayName ?? "none"
        return "\(pickerMode)-\(lineIndex)-\(activeType)"
    }
}

// MARK: - Section Labels Overlay

struct SectionPillsOverlay: View {
    let text: String
    let sectionTypes: [Int: SectionType]
    let lineHeights: [Int: CGFloat]
    let scrollOffset: CGFloat
    let viewportHeight: CGFloat
    let onBadgeTap: (Int) -> Void

    /// Margin for culling labels outside viewport
    private let cullMargin: CGFloat = 160

    var body: some View {
        let lines = text.components(separatedBy: "\n")
        let validStarts = SectionAnalyzer.getValidSectionStartSet(body: text)

        return ZStack(alignment: .topLeading) {
            ForEach(sectionTypes.keys.sorted(), id: \.self) { lineIndex in
                if let sectionType = sectionTypes[lineIndex], validStarts.contains(lineIndex) {
                    let yOffset = calculateYOffset(for: lineIndex)
                    let labelOffset = labelVerticalOffset(for: lineIndex, lines: lines)
                    let visibleY = yOffset - scrollOffset - labelOffset

                    if isVisible(visibleY: visibleY) {
                        SectionPillLabel(sectionType: sectionType)
                            .offset(y: visibleY)
                            .onTapGesture {
                                onBadgeTap(lineIndex)
                            }
                            .transition(
                                .asymmetric(
                                    insertion: .opacity.combined(with: .offset(x: 6)),
                                    removal: .opacity
                                ))
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .clipped()
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: sectionTypes)
    }

    private func calculateYOffset(for lineIndex: Int) -> CGFloat {
        var offset: CGFloat = Theme.editorPaddingTop
        for i in 0..<lineIndex {
            offset += lineHeights[i] ?? Theme.editorLineHeight
        }
        return offset
    }

    private func labelVerticalOffset(for lineIndex: Int, lines: [String]) -> CGFloat {
        let lift = Theme.editorLineHeight * 0.75
        guard lineIndex > 0, lineIndex - 1 < lines.count else {
            return lift
        }
        if SectionAnalyzer.isBlankLine(lines[lineIndex - 1]) {
            return lift
        }
        return Theme.editorLineHeight * 0.6
    }

    /// Check if a label at the given Y offset is within the visible viewport (with margin)
    private func isVisible(visibleY: CGFloat) -> Bool {
        let visibleTop = -cullMargin
        let visibleBottom = viewportHeight + cullMargin
        return visibleY >= visibleTop && visibleY <= visibleBottom
    }
}

struct SectionPillLabel: View {
    let sectionType: SectionType

    private var colors: (accent: Color, tint: Color) {
        Theme.sectionColors[sectionType] ?? (Theme.accent, Theme.accentSoft)
    }

    var body: some View {
        Text(sectionType.displayName.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(2)
            .foregroundStyle(colors.accent)
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .background(colors.tint.opacity(0.9))
            .overlay(
                Capsule()
                    .stroke(colors.accent.opacity(0.6), lineWidth: 1)
            )
            .clipShape(Capsule())
    }
}

private struct SectionPillTapOverlay: UIViewRepresentable {
    let text: String
    let sectionTypes: [Int: SectionType]
    let lineHeights: [Int: CGFloat]
    let scrollOffset: CGFloat
    let viewportHeight: CGFloat
    let onBadgeTap: (Int) -> Void

    func makeUIView(context: Context) -> SectionPillTapOverlayView {
        SectionPillTapOverlayView()
    }

    func updateUIView(_ uiView: SectionPillTapOverlayView, context: Context) {
        uiView.onBadgeTap = onBadgeTap

        let lines = text.components(separatedBy: "\n")
        let validStarts = SectionAnalyzer.getValidSectionStartSet(body: text)
        let targets = sectionTypes.keys.sorted().compactMap { lineIndex -> SectionPillTapTarget? in
            guard let sectionType = sectionTypes[lineIndex], validStarts.contains(lineIndex) else {
                return nil
            }

            let yOffset = calculateYOffset(for: lineIndex)
            let labelOffset = labelVerticalOffset(for: lineIndex, lines: lines)
            let visibleY = yOffset - scrollOffset - labelOffset

            guard isVisible(visibleY: visibleY) else { return nil }

            let frame = CGRect(
                x: -8,
                y: visibleY - 4,
                width: sectionPillWidth(for: sectionType) + 16,
                height: sectionPillHeight + 8
            )
            return SectionPillTapTarget(lineIndex: lineIndex, frame: frame)
        }

        uiView.updateTargets(targets)
    }

    private func calculateYOffset(for lineIndex: Int) -> CGFloat {
        var offset: CGFloat = Theme.editorPaddingTop
        for i in 0..<lineIndex {
            offset += lineHeights[i] ?? Theme.editorLineHeight
        }
        return offset
    }

    private func labelVerticalOffset(for lineIndex: Int, lines: [String]) -> CGFloat {
        let lift = Theme.editorLineHeight * 0.75
        guard lineIndex > 0, lineIndex - 1 < lines.count else {
            return lift
        }
        if SectionAnalyzer.isBlankLine(lines[lineIndex - 1]) {
            return lift
        }
        return Theme.editorLineHeight * 0.6
    }

    private func isVisible(visibleY: CGFloat) -> Bool {
        let cullMargin: CGFloat = 160
        return visibleY >= -cullMargin && visibleY <= viewportHeight + cullMargin
    }

    private func sectionPillWidth(for type: SectionType) -> CGFloat {
        let text = type.displayName.uppercased()
        let font = UIFont.systemFont(ofSize: 11, weight: .semibold)
        let baseWidth = (text as NSString).size(withAttributes: [.font: font]).width
        let tracking: CGFloat = 2
        let extraTracking = tracking * CGFloat(max(0, text.count - 1))
        return baseWidth + extraTracking + 24
    }

    private var sectionPillHeight: CGFloat {
        UIFont.systemFont(ofSize: 11, weight: .semibold).lineHeight + 10
    }
}

private struct SectionPillTapTarget: Equatable {
    let lineIndex: Int
    let frame: CGRect
}

private final class SectionPillTapOverlayView: UIView {
    var onBadgeTap: ((Int) -> Void)?
    private var buttons: [Int: UIButton] = [:]

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        buttons.values.contains { !$0.isHidden && $0.frame.contains(point) }
    }

    func updateTargets(_ targets: [SectionPillTapTarget]) {
        let activeLineIndices = Set(targets.map(\.lineIndex))

        for (lineIndex, button) in buttons where !activeLineIndices.contains(lineIndex) {
            button.removeFromSuperview()
            buttons.removeValue(forKey: lineIndex)
        }

        for target in targets {
            let button = buttons[target.lineIndex] ?? makeButton(for: target.lineIndex)
            button.frame = target.frame
            button.isHidden = false
        }
    }

    private func makeButton(for lineIndex: Int) -> UIButton {
        let button = UIButton(type: .custom)
        button.backgroundColor = .clear
        button.tag = lineIndex
        button.addTarget(self, action: #selector(handleTap(_:)), for: .touchUpInside)
        addSubview(button)
        buttons[lineIndex] = button
        return button
    }

    @objc
    private func handleTap(_ sender: UIButton) {
        onBadgeTap?(sender.tag)
    }
}

// MARK: - Section Badges Gutter

struct SectionBadgesGutter: View {
    let sectionTypes: [Int: SectionType]
    let validStarts: Set<Int>
    let lineHeights: [Int: CGFloat]
    let scrollOffset: CGFloat
    let viewportHeight: CGFloat
    let onBadgeTap: (Int) -> Void

    /// Margin for culling badges outside viewport
    private let cullMargin: CGFloat = 160

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .topLeading) {
                ForEach(Array(validStarts.sorted()), id: \.self) { lineIndex in
                    if let sectionType = sectionTypes[lineIndex] {
                        let yOffset = calculateYOffset(for: lineIndex)
                        let visibleY = yOffset - scrollOffset

                        // Cull badges far outside viewport for performance
                        if isVisible(visibleY: visibleY) {
                            SectionBadge(sectionType: sectionType)
                                .offset(y: visibleY)
                                .onTapGesture {
                                    onBadgeTap(lineIndex)
                                }
                                .transition(
                                    .asymmetric(
                                        insertion: .opacity.combined(with: .offset(x: 6)),
                                        removal: .opacity
                                    ))
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .clipped()
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: sectionTypes)
        }
        .background(Theme.secondaryBackgroundColor.opacity(0.5))
    }

    private func calculateYOffset(for lineIndex: Int) -> CGFloat {
        var offset: CGFloat = Theme.editorPaddingTop
        for i in 0..<lineIndex {
            offset += lineHeights[i] ?? Theme.editorLineHeight
        }
        return offset
    }

    /// Check if a badge at the given Y offset is within the visible viewport (with margin)
    private func isVisible(visibleY: CGFloat) -> Bool {
        let visibleTop = -cullMargin
        let visibleBottom = viewportHeight + cullMargin
        return visibleY >= visibleTop && visibleY <= visibleBottom
    }
}

// MARK: - Line Numbers Gutter

struct LineNumbersGutter: View {
    let bodyText: String
    let lineHeights: [Int: CGFloat]
    let scrollOffset: CGFloat
    let onTap: (() -> Void)?

    private let fontSize: CGFloat = 11

    private var baselineOffset: CGFloat {
        let editorFont = UIFont.monospacedSystemFont(ofSize: Theme.editorFontSize, weight: .regular)
        let numberFont = UIFont.monospacedSystemFont(ofSize: fontSize, weight: .regular)
        let extra = max(0, Theme.editorLineHeight - editorFont.lineHeight)
        return (extra / 2) + editorFont.ascender - numberFont.ascender + 4
    }

    var body: some View {
        let lines = bodyText.components(separatedBy: "\n")
        let validStarts = SectionAnalyzer.getValidSectionStartSet(body: bodyText)
        let displayNumbers = buildDisplayNumbers(lines: lines, validStarts: validStarts)

        let gutter = GeometryReader { _ in
            ZStack(alignment: .topTrailing) {
                ForEach(0..<max(1, lines.count), id: \.self) { lineIndex in
                    let yOffset = calculateYOffset(for: lineIndex)
                    let number = lineIndex < displayNumbers.count ? displayNumbers[lineIndex] : nil

                    if let number {
                        Text("\(number)")
                            .font(.system(size: fontSize, design: .monospaced))
                            .foregroundStyle(Theme.muted.opacity(0.35))
                            .frame(
                                height: lineHeights[lineIndex] ?? Theme.editorLineHeight,
                                alignment: .top
                            )
                            .offset(y: yOffset - scrollOffset + baselineOffset)
                            .padding(.trailing, 6)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
            .clipped()
        }

        if let onTap {
            gutter.onTapGesture(perform: onTap)
        } else {
            gutter.allowsHitTesting(false)
        }
    }

    private func buildDisplayNumbers(lines: [String], validStarts: Set<Int>) -> [Int?] {
        var displayNumbers: [Int?] = Array(repeating: nil, count: lines.count)
        var nextNumber = 1

        for index in 0..<lines.count {
            if shouldShowNumber(for: index, lines: lines, validStarts: validStarts) {
                displayNumbers[index] = nextNumber
                nextNumber += 1
            }
        }

        return displayNumbers
    }

    private func shouldShowNumber(for index: Int, lines: [String], validStarts: Set<Int>) -> Bool {
        let line = lines[index]
        let isBlank = line.trimmingCharacters(in: .whitespaces).isEmpty

        if !isBlank {
            return true
        }

        let nextIndex = index + 1
        if nextIndex < lines.count, validStarts.contains(nextIndex) {
            return false
        }

        return true
    }

    private func calculateYOffset(for lineIndex: Int) -> CGFloat {
        var offset: CGFloat = Theme.editorPaddingTop
        for i in 0..<lineIndex {
            offset += lineHeights[i] ?? Theme.editorLineHeight
        }
        return offset
    }
}

// MARK: - Syllable Counts Gutter

struct SyllableCountsGutter: View {
    let parsedLines: [ParsedLine]
    let lineHeights: [Int: CGFloat]
    let scrollOffset: CGFloat

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .topLeading) {
                ForEach(parsedLines, id: \.index) { line in
                    if let syllableCount = line.syllableCount, syllableCount > 0 {
                        let yOffset = calculateYOffset(for: line.index)

                        Text("\(syllableCount)")
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(.secondary)
                            .frame(
                                height: lineHeights[line.index] ?? Theme.editorLineHeight,
                                alignment: .top
                            )
                            .offset(y: yOffset - scrollOffset)
                            .padding(.leading, 4)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .clipped()
        }
        .background(Theme.secondaryBackgroundColor.opacity(0.3))
    }

    private func calculateYOffset(for lineIndex: Int) -> CGFloat {
        var offset: CGFloat = 8  // Top padding to match text
        for i in 0..<lineIndex {
            offset += lineHeights[i] ?? Theme.editorLineHeight
        }
        return offset
    }
}

// MARK: - UITextView Wrapper

final class LyricTextView: UITextView {
    private let rhymeAccessoryView = RhymeAccessoryInputView()
    var shouldSuppressSelectionAtPoint: ((CGPoint) -> Bool)?
    var onBoundsWidthChange: ((LyricTextView) -> Void)?
    private var lastLaidOutWidth: CGFloat = 0

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: UIView.noIntrinsicMetric)
    }

    override func closestPosition(to point: CGPoint) -> UITextPosition? {
        guard shouldSuppressSelectionAtPoint?(point) != true else {
            return nil
        }

        return super.closestPosition(to: point)
    }

    override func layoutSubviews() {
        super.layoutSubviews()

        let width = bounds.width
        guard width > 0 else { return }

        if abs(width - lastLaidOutWidth) > 0.5 {
            lastLaidOutWidth = width
            onBoundsWidthChange?(self)
        }

        updateMeasuredContentSize()
    }

    override func caretRect(for position: UITextPosition) -> CGRect {
        var rect = super.caretRect(for: position)
        let font = typingAttributes[.font] as? UIFont ?? self.font
        let targetHeight = font?.lineHeight ?? rect.height

        guard targetHeight > 0, rect.height > 0 else { return rect }

        let delta = rect.height - targetHeight
        rect.origin.y += (delta / 2) + caretVerticalOffset
        rect.size.height = targetHeight
        return rect
    }

    private var caretVerticalOffset: CGFloat {
        5
    }

    private func updateMeasuredContentSize() {
        layoutManager.ensureLayout(for: textContainer)

        let usedRect = layoutManager.usedRect(for: textContainer)
        let measuredHeight = ceil(
            usedRect.maxY + textContainerInset.top + textContainerInset.bottom
        )
        let targetHeight = max(bounds.height, measuredHeight)

        guard abs(contentSize.height - targetHeight) > 0.5 else { return }

        contentSize = CGSize(
            width: max(bounds.width, contentSize.width),
            height: targetHeight
        )
    }

    func configureRhymeAccessory(isVisible: Bool) {
        inputAccessoryView = isVisible ? rhymeAccessoryView : nil
    }

    func updateRhymeAccessory(
        isVisible: Bool,
        currentWord: String?,
        rhymes: [String],
        onSelectRhyme: @escaping (String) -> Void
    ) {
        let targetAccessoryView: UIView? = isVisible ? rhymeAccessoryView : nil
        if inputAccessoryView !== targetAccessoryView {
            inputAccessoryView = targetAccessoryView
            if isFirstResponder {
                reloadInputViews()
            }
        }

        guard isVisible else { return }
        rhymeAccessoryView.update(
            currentWord: currentWord,
            rhymes: rhymes,
            onSelectRhyme: onSelectRhyme
        )
    }
}

struct LyricTextViewRepresentable: UIViewRepresentable, Equatable {
    @Binding var text: String
    let sectionTypes: [Int: SectionType]
    let lineHeights: [Int: CGFloat]
    let lineHeight: CGFloat
    let fontSize: CGFloat
    let currentWord: String?
    let keyboardInset: CGFloat
    let showsRhymeSuggestions: Bool
    let onLineHeightsChange: ([Int: CGFloat]) -> Void
    let onScroll: (CGFloat) -> Void
    let onSectionBadgeTap: (Int) -> Void
    let onCursorChange: ((Int, String?) -> Void)?
    let onTap: (() -> Void)?

    struct EditorTextStyle: Equatable {
        let lineHeight: CGFloat
        let fontSize: CGFloat
    }

    static func == (lhs: LyricTextViewRepresentable, rhs: LyricTextViewRepresentable) -> Bool {
        lhs.text == rhs.text
            && lhs.sectionTypes == rhs.sectionTypes
            && lhs.lineHeights == rhs.lineHeights
            && lhs.lineHeight == rhs.lineHeight
            && lhs.fontSize == rhs.fontSize
            && lhs.currentWord == rhs.currentWord
            && lhs.keyboardInset == rhs.keyboardInset
            && lhs.showsRhymeSuggestions == rhs.showsRhymeSuggestions
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        guard let width = proposal.width, let height = proposal.height else {
            return nil
        }

        return CGSize(width: width, height: height)
    }

    func makeUIView(context: Context) -> UITextView {
        let textView = LyricTextView()
        textView.configureRhymeAccessory(isVisible: showsRhymeSuggestions)
        textView.delegate = context.coordinator
        textView.textContainerInset = UIEdgeInsets(
            top: Theme.editorPaddingTop,
            left: Theme.editorHorizontalPadding,
            bottom: 8,
            right: Theme.editorHorizontalPadding
        )
        textView.textContainer.lineFragmentPadding = 0
        textView.textContainer.heightTracksTextView = false
        textView.textContainer.widthTracksTextView = true
        textView.autocorrectionType = .no
        textView.autocapitalizationType = .none
        textView.spellCheckingType = .no
        textView.showsVerticalScrollIndicator = false
        textView.showsHorizontalScrollIndicator = false
        textView.isScrollEnabled = true
        textView.alwaysBounceVertical = true
        textView.contentInsetAdjustmentBehavior = .never
        textView.backgroundColor = .clear
        textView.textAlignment = .left
        textView.tintColor = UIColor(Theme.accentPressed)
        textView.keyboardDismissMode = .none
        textView.inputAssistantItem.leadingBarButtonGroups = []
        textView.inputAssistantItem.trailingBarButtonGroups = []
        textView.setContentHuggingPriority(.defaultLow, for: .vertical)
        textView.setContentCompressionResistancePriority(.defaultLow, for: .vertical)
        applyTextStyle(to: textView, preserveSelection: false)
        context.coordinator.appliedTextStyle = currentTextStyle
        updateInsets(for: textView)
        textView.onBoundsWidthChange = { lyricTextView in
            self.calculateLineHeights(for: lyricTextView)
        }
        let tapRecognizer = UITapGestureRecognizer(
            target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        tapRecognizer.cancelsTouchesInView = false
        tapRecognizer.delegate = context.coordinator
        textView.addGestureRecognizer(tapRecognizer)
        updateRhymeAccessory(for: textView, coordinator: context.coordinator)
        return textView
    }

    func updateUIView(_ uiView: UITextView, context: Context) {
        context.coordinator.parent = self

        if uiView.text != text {
            applyTextStyle(to: uiView, preserveSelection: true)
            context.coordinator.appliedTextStyle = currentTextStyle
            DispatchQueue.main.async {
                self.calculateLineHeights(for: uiView)
            }
        } else if context.coordinator.appliedTextStyle != currentTextStyle {
            applyTextAttributesInPlace(to: uiView)
            context.coordinator.appliedTextStyle = currentTextStyle
            DispatchQueue.main.async {
                self.calculateLineHeights(for: uiView)
            }
        } else {
            uiView.typingAttributes = textAttributes()
        }

        updateInsets(for: uiView)
        updateRhymeAccessory(for: uiView, coordinator: context.coordinator)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    private var rhymeSuggestions: [String] {
        guard let currentWord, !currentWord.isEmpty else { return [] }
        return Array(RhymeDictionary.shared.getRhymes(for: currentWord).prefix(12))
    }

    private func updateRhymeAccessory(for textView: UITextView, coordinator: Coordinator) {
        guard let lyricTextView = textView as? LyricTextView else { return }
        lyricTextView.shouldSuppressSelectionAtPoint = { [weak lyricTextView] point in
            guard let lyricTextView else { return false }
            return coordinator.isSectionPillRowHit(at: point, in: lyricTextView)
        }
        lyricTextView.updateRhymeAccessory(
            isVisible: showsRhymeSuggestions,
            currentWord: currentWord,
            rhymes: rhymeSuggestions,
            onSelectRhyme: { rhyme in
                coordinator.insertRhyme(rhyme, into: lyricTextView)
            }
        )
    }

    private func updateInsets(for textView: UITextView) {
        let accessoryInset = showsRhymeSuggestions ? rhymeAccessoryHeight : 0
        let visibleBottomInset = max(0, keyboardInset) + accessoryInset
        let bottomTextInset: CGFloat = bottomReadableInset
        let desiredTextContainerInset = UIEdgeInsets(
            top: Theme.editorPaddingTop,
            left: Theme.editorHorizontalPadding,
            bottom: bottomTextInset,
            right: Theme.editorHorizontalPadding
        )
        let desiredContentInset = UIEdgeInsets(
            top: 0,
            left: 0,
            bottom: visibleBottomInset,
            right: 0
        )
        let desiredScrollIndicatorInsets = UIEdgeInsets(
            top: 0,
            left: 0,
            bottom: visibleBottomInset,
            right: 0
        )

        if textView.textContainerInset != desiredTextContainerInset {
            textView.textContainerInset = desiredTextContainerInset
        }
        if textView.contentInset != desiredContentInset {
            textView.contentInset = desiredContentInset
        }
        let currentScrollIndicatorInsets = UIEdgeInsets(
            top: textView.verticalScrollIndicatorInsets.top,
            left: textView.horizontalScrollIndicatorInsets.left,
            bottom: textView.verticalScrollIndicatorInsets.bottom,
            right: textView.horizontalScrollIndicatorInsets.right
        )
        if currentScrollIndicatorInsets != desiredScrollIndicatorInsets {
            textView.scrollIndicatorInsets = desiredScrollIndicatorInsets
        }
    }

    private var rhymeAccessoryHeight: CGFloat {
        78
    }

    private var bottomReadableInset: CGFloat {
        Theme.editorLineHeight
    }

    private func calculateLineHeights(for textView: UITextView) {
        let text = textView.text ?? ""
        let lines = text.components(separatedBy: "\n")
        var heights: [Int: CGFloat] = [:]

        let layoutManager = textView.layoutManager
        layoutManager.ensureLayout(for: textView.textContainer)

        var location = 0
        for (index, line) in lines.enumerated() {
            let lineLength = line.utf16.count
            let range = NSRange(location: location, length: lineLength)
            location += lineLength
            if index < lines.count - 1 {
                location += 1
            }

            let glyphRange = layoutManager.glyphRange(
                forCharacterRange: range, actualCharacterRange: nil)
            var height: CGFloat = 0

            if lineLength == 0 {
                height = lineHeight
            } else if glyphRange.length > 0 {
                var glyphIndex = glyphRange.location
                while glyphIndex < NSMaxRange(glyphRange) {
                    var lineRange = NSRange()
                    let rect = layoutManager.lineFragmentRect(
                        forGlyphAt: glyphIndex, effectiveRange: &lineRange)
                    height += rect.height
                    glyphIndex = NSMaxRange(lineRange)
                }
            }

            if height == 0 {
                height = max(lineHeight, layoutManager.extraLineFragmentRect.height)
            } else {
                height = max(height, lineHeight)
            }

            heights[index] = height
        }

        if !heights.isEmpty, heights != lineHeights {
            onLineHeightsChange(heights)
        }
    }

    private func applyTextStyle(to textView: UITextView, preserveSelection: Bool) {
        let selectedRange = textView.selectedRange
        let attributes = textAttributes()

        textView.attributedText = NSAttributedString(string: text, attributes: attributes)
        textView.typingAttributes = attributes

        if preserveSelection {
            let clampedLocation = min(selectedRange.location, textView.text.count)
            let maxLength = max(0, textView.text.count - clampedLocation)
            let clampedLength = min(selectedRange.length, maxLength)
            textView.selectedRange = NSRange(location: clampedLocation, length: clampedLength)
        }
    }

    private func textAttributes() -> [NSAttributedString.Key: Any] {
        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.minimumLineHeight = lineHeight
        paragraphStyle.maximumLineHeight = lineHeight
        paragraphStyle.alignment = .left

        return [
            .font: UIFont.monospacedSystemFont(ofSize: fontSize, weight: .regular),
            .paragraphStyle: paragraphStyle,
            .foregroundColor: UIColor(Theme.muted),
        ]
    }

    private var currentTextStyle: EditorTextStyle {
        EditorTextStyle(lineHeight: lineHeight, fontSize: fontSize)
    }

    private func applyTextAttributesInPlace(to textView: UITextView) {
        let attributes = textAttributes()
        let range = NSRange(location: 0, length: textView.textStorage.length)

        textView.textStorage.beginEditing()
        textView.textStorage.setAttributes(attributes, range: range)
        textView.textStorage.endEditing()
        textView.typingAttributes = attributes
    }

    class Coordinator: NSObject, UITextViewDelegate, UIGestureRecognizerDelegate {
        var parent: LyricTextViewRepresentable
        var appliedTextStyle: EditorTextStyle?

        init(_ parent: LyricTextViewRepresentable) {
            self.parent = parent
        }

        func textViewDidChange(_ textView: UITextView) {
            parent.text = textView.text
            updateCursorInfo(textView)
            scrollCaretIntoView(for: textView, animated: false)
        }

        func textViewDidChangeSelection(_ textView: UITextView) {
            updateCursorInfo(textView)
        }

        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            parent.onScroll(scrollView.contentOffset.y)
        }

        @objc func handleTap(_ recognizer: UITapGestureRecognizer) {
            parent.onTap?()
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldReceive touch: UITouch
        ) -> Bool {
            parent.onTap != nil
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool {
            true
        }

        func insertRhyme(_ rhyme: String, into textView: UITextView) {
            let replacement = RhymeSuggestionEditing.replacingWordAtCaret(
                in: textView.text ?? "",
                selectedRange: textView.selectedRange,
                with: rhyme
            )

            parent.text = replacement.text
            parent.applyTextStyle(to: textView, preserveSelection: false)
            textView.selectedRange = replacement.selectedRange
            updateCursorInfo(textView)
            scrollCaretIntoView(for: textView, animated: true)
        }

        private func updateCursorInfo(_ textView: UITextView) {
            let position = textView.selectedRange.location
            let text = textView.text ?? ""

            // Calculate line index from cursor position
            let lineIndex = calculateLineIndex(from: position, in: text)

            // Find word at cursor position
            let word = findWordAtPosition(position, in: text)

            parent.onCursorChange?(lineIndex, word)
        }

        func scrollCaretIntoView(for textView: UITextView, animated: Bool) {
            guard let selectedTextRange = textView.selectedTextRange else { return }

            var caretRect = textView.caretRect(for: selectedTextRange.end)
            caretRect = caretRect.insetBy(dx: 0, dy: -caretVisibilityPadding)

            let visibleHeight = max(
                0,
                textView.bounds.height - textView.contentInset.bottom
            )
            let visibleTop = textView.contentOffset.y
            let visibleBottom = visibleTop + visibleHeight

            var targetOffsetY = textView.contentOffset.y
            if caretRect.maxY > visibleBottom {
                targetOffsetY += caretRect.maxY - visibleBottom
            } else if caretRect.minY < visibleTop {
                targetOffsetY -= visibleTop - caretRect.minY
            } else {
                return
            }

            let minOffsetY = -textView.contentInset.top
            let maxOffsetY = max(
                minOffsetY,
                textView.contentSize.height - visibleHeight
            )
            targetOffsetY = min(max(targetOffsetY, minOffsetY), maxOffsetY)
            textView.setContentOffset(
                CGPoint(x: textView.contentOffset.x, y: targetOffsetY),
                animated: animated
            )
        }

        private var caretVisibilityPadding: CGFloat {
            12
        }

        func isSectionPillRowHit(at location: CGPoint, in textView: UITextView) -> Bool {
            let lines = parent.text.components(separatedBy: "\n")
            let validStarts = SectionAnalyzer.getValidSectionStartSet(body: parent.text)

            for lineIndex in parent.sectionTypes.keys.sorted() where validStarts.contains(lineIndex) {
                let yOffset = calculateYOffset(for: lineIndex)
                let labelOffset = labelVerticalOffset(for: lineIndex, lines: lines)
                let visibleY = yOffset - textView.contentOffset.y - labelOffset
                let hitRect = CGRect(
                    x: 0,
                    y: visibleY - 4,
                    width: textView.bounds.width,
                    height: sectionPillHeight + 8
                )

                if hitRect.contains(location) {
                    return true
                }
            }

            return false
        }

        private func calculateYOffset(for lineIndex: Int) -> CGFloat {
            var offset: CGFloat = Theme.editorPaddingTop
            for i in 0..<lineIndex {
                offset += parent.lineHeights[i] ?? Theme.editorLineHeight
            }
            return offset
        }

        private func labelVerticalOffset(for lineIndex: Int, lines: [String]) -> CGFloat {
            let lift = Theme.editorLineHeight * 0.75
            guard lineIndex > 0, lineIndex - 1 < lines.count else {
                return lift
            }
            if SectionAnalyzer.isBlankLine(lines[lineIndex - 1]) {
                return lift
            }
            return Theme.editorLineHeight * 0.6
        }

        private var sectionPillHeight: CGFloat {
            UIFont.systemFont(ofSize: 11, weight: .semibold).lineHeight + 10
        }

        private func calculateLineIndex(from position: Int, in text: String) -> Int {
            guard position <= text.count else { return 0 }

            let prefix = String(text.prefix(position))
            let lineIndex = prefix.components(separatedBy: "\n").count - 1
            return max(0, lineIndex)
        }

        private func findWordAtPosition(_ position: Int, in text: String) -> String? {
            RhymeSuggestionEditing.currentWordAtCaret(at: position, in: text)
        }

    }
}

enum RhymeSuggestionEditing {
    static func currentWordAtCaret(at selectionLocation: Int, in text: String) -> String? {
        guard !text.isEmpty else { return nil }

        let nsText = text as NSString
        guard let wordRange = wordRange(at: selectionLocation, in: nsText) else {
            return nil
        }

        return nsText.substring(with: wordRange).lowercased()
    }

    static func replacingWordAtCaret(
        in text: String,
        selectedRange: NSRange,
        with replacement: String
    ) -> (text: String, selectedRange: NSRange) {
        let mutableText = NSMutableString(string: text)
        let clampedLocation = min(max(0, selectedRange.location), mutableText.length)

        if let targetRange = wordRange(at: clampedLocation, in: mutableText) {
            mutableText.replaceCharacters(in: targetRange, with: replacement)
            let updatedSelection = NSRange(
                location: targetRange.location + (replacement as NSString).length,
                length: 0
            )
            return (mutableText as String, updatedSelection)
        }

        mutableText.replaceCharacters(in: NSRange(location: clampedLocation, length: 0), with: replacement)
        let updatedSelection = NSRange(
            location: clampedLocation + (replacement as NSString).length,
            length: 0
        )
        return (mutableText as String, updatedSelection)
    }

    private static func wordRange(at selectionLocation: Int, in text: NSString) -> NSRange? {
        guard text.length > 0 else { return nil }

        let clampedLocation = min(max(0, selectionLocation), text.length)
        let candidateLocations = candidateProbeLocations(for: clampedLocation, textLength: text.length)
        let fullRange = NSRange(location: 0, length: text.length)

        for probeLocation in candidateLocations {
            guard let match = wordRegex?.matches(in: text as String, range: fullRange).first(where: {
                NSLocationInRange(probeLocation, $0.range)
            }) else {
                continue
            }

            return match.range
        }

        return nil
    }

    private static func candidateProbeLocations(for location: Int, textLength: Int) -> [Int] {
        guard textLength > 0 else { return [] }

        var candidates: [Int] = []
        if location < textLength {
            candidates.append(location)
        }
        if location > 0 {
            candidates.append(location - 1)
        }
        return candidates.enumerated().filter { index, value in
            candidates.firstIndex(of: value) == index
        }.map(\.element)
    }

    private static let wordRegex = try? NSRegularExpression(pattern: "[\\p{L}']+")
}

#Preview {
    let sampleTypes: [Int: SectionType] = [0: .verse, 3: .chorus]
    return LyricTextEditor(
        text: .constant("First line\nSecond line\n\nThird section"),
        sectionTypes: sampleTypes,
        parsedLines: LineParser.parseLyricBody("First line\nSecond line\n\nThird section"),
        currentWord: "section",
        keyboardInset: 0,
        showsRhymeSuggestions: true,
        onSectionBadgeTap: { _ in },
        onCursorChange: { _, _ in },
        pickerLineIndex: Optional<Int>.none,
        pickerMode: PickerMode.new,
        onPickerSelect: { _ in },
        onPickerDismiss: {}
    )
    .frame(height: 300)
}
