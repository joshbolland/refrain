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
                    }
                }

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
                    .frame(width: availableWidth, alignment: .leading)
                    .offset(
                        x: xOffset,
                        y: yOffset
                    )
                }
            }
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

        GeometryReader { _ in
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
        .onTapGesture {
            onTap?()
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

struct LyricTextViewRepresentable: UIViewRepresentable {
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
        textView.autocorrectionType = .no
        textView.autocapitalizationType = .none
        textView.spellCheckingType = .no
        textView.showsVerticalScrollIndicator = false
        textView.showsHorizontalScrollIndicator = false
        textView.isScrollEnabled = true
        textView.alwaysBounceVertical = true
        textView.backgroundColor = .clear
        textView.textAlignment = .left
        textView.tintColor = UIColor(Theme.accentPressed)
        textView.keyboardDismissMode = .interactive
        applyTextStyle(to: textView, preserveSelection: false)
        updateInsets(for: textView)
        let tapRecognizer = UITapGestureRecognizer(
            target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        tapRecognizer.cancelsTouchesInView = false
        tapRecognizer.delegate = context.coordinator
        textView.addGestureRecognizer(tapRecognizer)
        updateRhymeAccessory(for: textView, coordinator: context.coordinator)
        return textView
    }

    func updateUIView(_ uiView: UITextView, context: Context) {
        if uiView.text != text || needsAttributesUpdate(uiView) {
            applyTextStyle(to: uiView, preserveSelection: true)
        }

        updateInsets(for: uiView)
        updateRhymeAccessory(for: uiView, coordinator: context.coordinator)

        // Calculate line heights after layout
        DispatchQueue.main.async {
            self.calculateLineHeights(for: uiView)
        }
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
        let visibleBottomInset = max(0, keyboardInset) + accessoryInset + 24
        let bottomTextInset: CGFloat = 16
        textView.textContainerInset = UIEdgeInsets(
            top: Theme.editorPaddingTop,
            left: Theme.editorHorizontalPadding,
            bottom: bottomTextInset,
            right: Theme.editorHorizontalPadding
        )
        textView.contentInset = UIEdgeInsets(top: 0, left: 0, bottom: visibleBottomInset, right: 0)
        textView.scrollIndicatorInsets = UIEdgeInsets(
            top: 0,
            left: 0,
            bottom: visibleBottomInset,
            right: 0
        )
    }

    private var rhymeAccessoryHeight: CGFloat {
        78
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

        if !heights.isEmpty {
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

    private func needsAttributesUpdate(_ textView: UITextView) -> Bool {
        guard let paragraphStyle = textView.typingAttributes[.paragraphStyle] as? NSParagraphStyle
        else {
            return true
        }

        if paragraphStyle.minimumLineHeight != lineHeight
            || paragraphStyle.maximumLineHeight != lineHeight || paragraphStyle.alignment != .left
        {
            return true
        }

        guard let font = textView.typingAttributes[.font] as? UIFont else {
            return true
        }

        if font.pointSize != fontSize {
            return true
        }

        let expectedFont = UIFont.monospacedSystemFont(ofSize: fontSize, weight: .regular)
        return font.fontName != expectedFont.fontName
    }

    class Coordinator: NSObject, UITextViewDelegate, UIGestureRecognizerDelegate {
        var parent: LyricTextViewRepresentable

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
            scrollCaretIntoView(for: textView, animated: true)
        }

        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            parent.onScroll(scrollView.contentOffset.y)
        }

        @objc func handleTap(_ recognizer: UITapGestureRecognizer) {
            guard let textView = recognizer.view as? UITextView else {
                parent.onTap?()
                return
            }

            let location = recognizer.location(in: textView)
            if let tappedLineIndex = badgeLineIndex(at: location, in: textView) {
                parent.onSectionBadgeTap(tappedLineIndex)
                return
            }

            parent.onTap?()
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldReceive touch: UITouch
        ) -> Bool {
            guard let textView = gestureRecognizer.view as? UITextView else {
                return parent.onTap != nil
            }

            if parent.onTap != nil {
                return true
            }

            let location = touch.location(in: textView)
            return badgeLineIndex(at: location, in: textView) != nil
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
            caretRect = caretRect.insetBy(dx: 0, dy: -12)
            textView.scrollRectToVisible(caretRect, animated: animated)
        }

        private func badgeLineIndex(at location: CGPoint, in textView: UITextView) -> Int? {
            let lines = parent.text.components(separatedBy: "\n")
            let validStarts = SectionAnalyzer.getValidSectionStartSet(body: parent.text)
            let pillHeight = sectionPillHeight

            for lineIndex in parent.sectionTypes.keys.sorted() where validStarts.contains(lineIndex) {
                guard let sectionType = parent.sectionTypes[lineIndex] else { continue }

                let yOffset = calculateYOffset(for: lineIndex)
                let labelOffset = labelVerticalOffset(for: lineIndex, lines: lines)
                let visibleY = yOffset - textView.contentOffset.y - labelOffset
                let pillWidth = sectionPillWidth(for: sectionType)
                let hitRect = CGRect(
                    x: Theme.editorHorizontalPadding - 8,
                    y: visibleY - 4,
                    width: pillWidth + 16,
                    height: pillHeight + 8
                )

                if hitRect.contains(location) {
                    return lineIndex
                }
            }

            return nil
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

        private func calculateYOffset(for lineIndex: Int) -> CGFloat {
            var offset: CGFloat = Theme.editorPaddingTop
            for index in 0..<lineIndex {
                offset += parent.lineHeights[index] ?? parent.lineHeight
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
