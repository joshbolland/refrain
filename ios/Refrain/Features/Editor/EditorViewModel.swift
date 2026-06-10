import SwiftUI
import Combine

@Observable
final class EditorViewModel {
    // MARK: - Published State

    var title: String {
        didSet {
            if title != oldValue {
                markDirty()
            }
        }
    }

    var body: String {
        didSet {
            if body != oldValue {
                updateParsedLines()
                updateSectionTypes()
                markDirty()
            }
        }
    }

    var sectionTypes: [Int: SectionType]

    var saveStatus: SaveStatus = .saved

    // Cursor/selection tracking
    var currentLineIndex: Int?
    var currentWord: String?

    // Inline section picker state
    var pickerLineIndex: Int?
    var pickerMode: PickerMode = .new
    private var suppressedAutoPickerLineIndex: Int?

    // MARK: - Computed Properties

    /// Whether this is a new file (untitled with empty body)
    var isNewFile: Bool {
        title == "Untitled" && body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private(set) var parsedLines: [ParsedLine] = []

    // MARK: - Internal State

    private let fileId: String
    private var isDirty = false
    private var saveTask: Task<Void, Never>?
    private let debounceInterval: TimeInterval = 0.5

    weak var appState: AppState?

    // MARK: - Initialization

    init(file: LyricFile) {
        self.fileId = file.id
        self.title = file.title
        self.body = file.body
        self.sectionTypes = file.sectionTypes
        self.parsedLines = LineParser.parseLyricBody(file.body)
    }

    // MARK: - Auto-Save

    func startAutoSave() async {
        // Already handled by debounced save
    }

    private func markDirty() {
        isDirty = true
        saveStatus = .unsaved

        // Cancel existing save task
        saveTask?.cancel()

        // Schedule new save
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(500))

            guard !Task.isCancelled else { return }

            await self?.save()
        }
    }

    @MainActor
    func save() async {
        guard isDirty else { return }

        saveStatus = .saving

        let updatedFile = LyricFile(
            id: fileId,
            title: title,
            body: body,
            createdAt: Date(), // Will be preserved by update
            updatedAt: Date(),
            sectionTypes: sectionTypes
        )

        await appState?.updateLyricFile(updatedFile)

        isDirty = false
        saveStatus = .saved
    }

    // MARK: - Line Parsing

    private func updateParsedLines() {
        parsedLines = LineParser.parseLyricBody(body)
    }

    // MARK: - Section Management

    private func updateSectionTypes() {
        // Clean up invalid section types
        sectionTypes = SectionAnalyzer.cleanupSectionTypes(body: body, sectionTypes: sectionTypes)
        // Ensure defaults for new sections
        sectionTypes = SectionAnalyzer.ensureDefaultSectionTypes(body: body, sectionTypes: sectionTypes)
    }

    func setSectionType(at lineIndex: Int, to type: SectionType) {
        sectionTypes[lineIndex] = type
        markDirty()
    }

    func removeSectionType(at lineIndex: Int) {
        sectionTypes.removeValue(forKey: lineIndex)
        markDirty()
    }

    func repeatPreviousChorus(at lineIndex: Int) {
        guard let previousChorusStart = SectionAnalyzer.findPreviousChorusStart(
            body: body,
            sectionTypes: sectionTypes,
            targetStartIndex: lineIndex
        ) else { return }

        // Get the text of the previous chorus
        let lines = body.components(separatedBy: "\n")
        let range = SectionAnalyzer.getSectionBlockRange(body: body, startIndex: previousChorusStart)
        let chorusText = SectionAnalyzer.extractBlockText(lines: lines, range: range)

        // Replace current section with chorus text
        let currentRange = SectionAnalyzer.getSectionBlockRange(body: body, startIndex: lineIndex)

        var newLines = lines
        let replaceRange = currentRange.start..<currentRange.endExclusive
        newLines.replaceSubrange(replaceRange, with: chorusText.components(separatedBy: "\n"))

        body = newLines.joined(separator: "\n")
        sectionTypes[lineIndex] = .chorus
    }

    // MARK: - Cursor Tracking

    func updateCursorPosition(lineIndex: Int, word: String?) {
        self.currentLineIndex = lineIndex
        self.currentWord = word
        evaluatePickerState()
    }

    // MARK: - Inline Picker Logic

    /// Evaluates whether the inline section picker should be shown
    /// Based on React Native logic: show picker when typing after a blank line
    /// on a line that doesn't already have a section type assigned
    private func evaluatePickerState() {
        guard let currentLineIndex = currentLineIndex else {
            pickerLineIndex = nil
            return
        }

        if let suppressed = suppressedAutoPickerLineIndex, suppressed != currentLineIndex {
            suppressedAutoPickerLineIndex = nil
        }

        let lines = body.components(separatedBy: "\n")
        let validStarts = SectionAnalyzer.getValidSectionStartSet(body: body)
        guard currentLineIndex < lines.count else {
            pickerLineIndex = nil
            return
        }

        if pickerMode == .new,
           let openPickerLineIndex = pickerLineIndex,
           !shouldAutoOpenPicker(at: openPickerLineIndex, lines: lines, validStarts: validStarts)
        {
            pickerLineIndex = nil
        }

        // Special case: auto-assign VERSE at line 0 when user starts typing
        // This handles the empty body case - no picker needed, just auto-assign
        if currentLineIndex == 0 && sectionTypes[0] == nil {
            let firstLineHasContent = !lines[0].trimmingCharacters(in: .whitespaces).isEmpty
            if firstLineHasContent {
                sectionTypes[0] = .verse
                markDirty()
                return
            }
        }

        let shouldOpen = shouldAutoOpenPicker(at: currentLineIndex, lines: lines, validStarts: validStarts)

        if shouldOpen, suppressedAutoPickerLineIndex == currentLineIndex {
            return
        }

        if shouldOpen && pickerLineIndex != currentLineIndex {
            pickerMode = .new
            pickerLineIndex = currentLineIndex
        } else if !shouldOpen && pickerLineIndex == currentLineIndex && pickerMode == .new {
            // Only auto-dismiss if it was auto-opened (new mode)
            pickerLineIndex = nil
        }

        if !shouldOpen && suppressedAutoPickerLineIndex == currentLineIndex {
            suppressedAutoPickerLineIndex = nil
        }
    }

    private func shouldAutoOpenPicker(at lineIndex: Int, lines: [String], validStarts: Set<Int>) -> Bool {
        guard lineIndex > 0, lineIndex < lines.count else { return false }

        let previousLineBlank = lines[lineIndex - 1].trimmingCharacters(in: .whitespaces).isEmpty
        let hasType = sectionTypes[lineIndex] != nil
        let currentLineIsBlank = lines[lineIndex].trimmingCharacters(in: .whitespaces).isEmpty
        let currentLineHasContent = !currentLineIsBlank
        let isExplicitSectionStart = validStarts.contains(lineIndex)

        return previousLineBlank &&
            !hasType &&
            (currentLineHasContent || (currentLineIsBlank && isExplicitSectionStart))
    }

    /// Opens the picker in edit mode for an existing section
    func openPickerForEditing(at lineIndex: Int) {
        if pickerMode == .edit, pickerLineIndex == lineIndex {
            pickerLineIndex = nil
            return
        }

        suppressedAutoPickerLineIndex = nil
        pickerMode = .edit
        pickerLineIndex = lineIndex
    }

    /// Manually opens the picker at a specific line in new mode
    func openPickerForNewSection(at lineIndex: Int) {
        suppressedAutoPickerLineIndex = nil
        pickerMode = .new
        pickerLineIndex = lineIndex
    }

    /// Dismisses the inline picker
    func dismissPicker(suppressAutoOpen: Bool = false) {
        if suppressAutoOpen, pickerMode == .new {
            suppressedAutoPickerLineIndex = pickerLineIndex ?? currentLineIndex
        }
        pickerLineIndex = nil
    }

    // MARK: - Valid Section Starts

    var validSectionStarts: Set<Int> {
        SectionAnalyzer.getValidSectionStartSet(body: body)
    }

    func isValidSectionStart(_ lineIndex: Int) -> Bool {
        validSectionStarts.contains(lineIndex)
    }
}
