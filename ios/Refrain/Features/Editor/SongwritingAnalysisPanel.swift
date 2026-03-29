import SwiftUI

struct SongwritingAnalysisPanel: View {
    let bodyText: String
    let parsedLines: [ParsedLine]
    let sectionTypes: [Int: SectionType]
    let currentLineIndex: Int?

    private var snapshot: SongwritingAnalysisSnapshot? {
        SongwritingAnalysisSnapshot(
            bodyText: bodyText,
            parsedLines: parsedLines,
            sectionTypes: sectionTypes,
            currentLineIndex: currentLineIndex
        )
    }

    var body: some View {
        Group {
            if let snapshot {
                VStack(alignment: .leading, spacing: 14) {
                    header(snapshot: snapshot)
                    summaryRow(snapshot: snapshot)
                    lineFeedback(snapshot: snapshot)
                }
                .padding(16)
                .background(Theme.paper)
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                        .stroke(Theme.divider, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            } else {
                Text("Write a few lyric lines to see meter and rhyme feedback.")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.muted.opacity(0.8))
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.paper)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                            .stroke(Theme.divider, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            }
        }
    }

    private func header(snapshot: SongwritingAnalysisSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(snapshot.sectionTitle)
                    .font(.system(size: 13, weight: .semibold))
                    .tracking(1.4)
                    .foregroundStyle(snapshot.sectionColor)

                Text(snapshot.focusLabel)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.muted.opacity(0.75))

                Spacer(minLength: 0)
            }

            Text(snapshot.prompt)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.ink)
        }
    }

    private func summaryRow(snapshot: SongwritingAnalysisSnapshot) -> some View {
        HStack(spacing: 10) {
            AnalysisSummaryCard(
                title: "Meter",
                value: snapshot.meterValue,
                detail: snapshot.meterDetail
            )

            AnalysisSummaryCard(
                title: "Scheme",
                value: snapshot.schemeValue,
                detail: snapshot.schemeDetail
            )

            AnalysisSummaryCard(
                title: "Drift",
                value: snapshot.driftValue,
                detail: snapshot.driftDetail
            )
        }
    }

    private func lineFeedback(snapshot: SongwritingAnalysisSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 0) {
                analysisColumnTitle("Line", width: 40, alignment: .leading)
                analysisColumnTitle("Count", width: 56, alignment: .leading)
                analysisColumnTitle("Rhyme", width: 56, alignment: .leading)
                analysisColumnTitle("Feedback", width: nil, alignment: .leading)
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(snapshot.lineRows) { row in
                        HStack(spacing: 0) {
                            Text("\(row.displayLineNumber)")
                                .font(.system(size: 12, design: .monospaced))
                                .foregroundStyle(row.isCurrentLine ? Theme.ink : Theme.muted.opacity(0.7))
                                .frame(width: 40, alignment: .leading)

                            HStack(spacing: 6) {
                                Text("\(row.syllableCount)")
                                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(row.deltaColor)

                                Text(row.deltaLabel)
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundStyle(row.deltaColor.opacity(0.8))
                            }
                            .frame(width: 56, alignment: .leading)

                            Text(row.rhymeLabel)
                                .font(.system(size: 12, weight: .semibold, design: .monospaced))
                                .foregroundStyle(Theme.accentPressed)
                                .frame(width: 56, alignment: .leading)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(row.feedback)
                                    .font(.system(size: 12, weight: row.isCurrentLine ? .semibold : .medium))
                                    .foregroundStyle(Theme.ink)
                                    .lineLimit(1)

                                if let endWord = row.endWord {
                                    Text("Ends on \(endWord)")
                                        .font(.system(size: 11))
                                        .foregroundStyle(Theme.muted.opacity(0.72))
                                        .lineLimit(1)
                                }
                            }

                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(row.isCurrentLine ? snapshot.sectionTint.opacity(0.7) : Theme.canvas)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(row.isCurrentLine ? snapshot.sectionColor.opacity(0.3) : Theme.divider, lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
            }
            .frame(maxHeight: 220)
        }
    }

    private func analysisColumnTitle(_ text: String, width: CGFloat?, alignment: Alignment) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .tracking(1.2)
            .foregroundStyle(Theme.muted.opacity(0.7))
            .frame(width: width, alignment: alignment)
    }
}

private struct AnalysisSummaryCard: View {
    let title: String
    let value: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(Theme.muted.opacity(0.72))

            Text(value)
                .font(.system(size: 18, weight: .semibold, design: .rounded))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.75)

            Text(detail)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.muted.opacity(0.78))
                .lineLimit(2)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.canvas)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct SongwritingAnalysisSnapshot {
    let sectionTitle: String
    let focusLabel: String
    let prompt: String
    let meterValue: String
    let meterDetail: String
    let schemeValue: String
    let schemeDetail: String
    let driftValue: String
    let driftDetail: String
    let sectionColor: Color
    let sectionTint: Color
    let lineRows: [SongwritingAnalysisLineRow]

    init?(
        bodyText: String,
        parsedLines: [ParsedLine],
        sectionTypes: [Int: SectionType],
        currentLineIndex: Int?
    ) {
        let sectionStarts = SectionAnalyzer.getSectionStartLineIndices(body: bodyText)
        let lyricLines = parsedLines.filter { $0.type == .lyric }

        guard !lyricLines.isEmpty else {
            return nil
        }

        let focusStart = SongwritingAnalysisSnapshot.focusSectionStart(
            sectionStarts: sectionStarts,
            lyricLines: lyricLines,
            currentLineIndex: currentLineIndex
        )

        let sectionType = focusStart.flatMap { sectionTypes[$0] } ?? .verse
        let sectionRange = focusStart.map { SectionAnalyzer.getSectionBlockRange(body: bodyText, startIndex: $0) }
        let scopedLines = SongwritingAnalysisSnapshot.scopedLyricLines(
            lyricLines: lyricLines,
            range: sectionRange
        )

        guard !scopedLines.isEmpty else {
            return nil
        }

        let syllableCounts = scopedLines.compactMap(\.syllableCount)
        let targetCount = SongwritingAnalysisSnapshot.targetCount(from: syllableCounts)
        let onTargetLineCount = syllableCounts.filter { abs($0 - targetCount) <= 1 }.count
        let maxDrift = syllableCounts.map { abs($0 - targetCount) }.max() ?? 0
        let rhymeMap = RhymeAnalyzer.computeRhymeGroups(scopedLines)
        let lineRows = scopedLines.map { line in
            SongwritingAnalysisLineRow(
                line: line,
                targetCount: targetCount,
                rhymeMap: rhymeMap,
                isCurrentLine: line.index == currentLineIndex
            )
        }

        let scheme = scopedLines
            .map { line in
                if let group = rhymeMap[line.index] {
                    return rhymeLetter(for: group.groupId)
                }
                return "–"
            }
            .joined()

        let prompt = SongwritingAnalysisSnapshot.prompt(
            currentLineIndex: currentLineIndex,
            lineRows: lineRows,
            targetCount: targetCount,
            onTargetLineCount: onTargetLineCount,
            totalLines: scopedLines.count,
            maxDrift: maxDrift
        )

        let focusLabel: String
        if let focusStart {
            focusLabel = "Lines \(focusStart + 1)-\((scopedLines.last?.index ?? focusStart) + 1)"
        } else {
            focusLabel = "Whole song"
        }

        self.sectionTitle = sectionType.displayName.uppercased()
        self.focusLabel = focusLabel
        self.prompt = prompt
        self.meterValue = "\(targetCount) syllables"
        self.meterDetail = "\(onTargetLineCount)/\(scopedLines.count) lines within one beat"
        self.schemeValue = scheme.isEmpty ? "–" : scheme
        self.schemeDetail = SongwritingAnalysisSnapshot.schemeDetail(from: lineRows)
        self.driftValue = maxDrift == 0 ? "Locked" : "±\(maxDrift)"
        self.driftDetail = maxDrift == 0 ? "Every line lands on target" : "Farthest line from target meter"
        self.sectionColor = Theme.sectionColor(for: sectionType)
        self.sectionTint = Theme.sectionTintColor(for: sectionType)
        self.lineRows = lineRows
    }

    private static func focusSectionStart(
        sectionStarts: [Int],
        lyricLines: [ParsedLine],
        currentLineIndex: Int?
    ) -> Int? {
        guard !sectionStarts.isEmpty else {
            return nil
        }

        let anchor = currentLineIndex ?? lyricLines.first?.index ?? 0
        return sectionStarts.last(where: { $0 <= anchor }) ?? sectionStarts.first
    }

    private static func scopedLyricLines(
        lyricLines: [ParsedLine],
        range: (start: Int, endExclusive: Int)?
    ) -> [ParsedLine] {
        guard let range else {
            return lyricLines
        }

        return lyricLines.filter { range.start <= $0.index && $0.index < range.endExclusive }
    }

    private static func targetCount(from syllableCounts: [Int]) -> Int {
        let groupedCounts = Dictionary(grouping: syllableCounts, by: { $0 })
        let sortedCounts = groupedCounts.sorted { lhs, rhs in
            if lhs.value.count == rhs.value.count {
                return lhs.key < rhs.key
            }
            return lhs.value.count > rhs.value.count
        }

        return sortedCounts.first?.key ?? 0
    }

    private static func prompt(
        currentLineIndex: Int?,
        lineRows: [SongwritingAnalysisLineRow],
        targetCount: Int,
        onTargetLineCount: Int,
        totalLines: Int,
        maxDrift: Int
    ) -> String {
        if let currentLineIndex,
           let currentLine = lineRows.first(where: { $0.lineIndex == currentLineIndex }),
           currentLine.absoluteDelta > 1
        {
            return "Current line is \(currentLine.deltaLabel) from the \(targetCount)-syllable pocket."
        }

        if onTargetLineCount == totalLines {
            return "Meter is steady. Keep the language tight and let rhyme carry the movement."
        }

        if let mostOffLine = lineRows.max(by: { $0.absoluteDelta < $1.absoluteDelta }), maxDrift > 1 {
            return "Line \(mostOffLine.displayLineNumber) drifts the most. Trim or split it to stay closer to the pocket."
        }

        return "Most lines are close. Nudge the outliers until the section breathes at the same pace."
    }

    private static func schemeDetail(from lineRows: [SongwritingAnalysisLineRow]) -> String {
        let repeatedRhymes = Dictionary(grouping: lineRows.filter { $0.rhymeLabel != "–" }, by: \.rhymeLabel)
            .values
            .filter { $0.count > 1 }
            .count

        if repeatedRhymes == 0 {
            return "No repeated end sounds yet"
        }

        if repeatedRhymes == 1 {
            return "One rhyme family is anchoring the section"
        }

        return "\(repeatedRhymes) rhyme families are in play"
    }
}

private struct SongwritingAnalysisLineRow: Identifiable {
    let id: Int
    let lineIndex: Int
    let displayLineNumber: Int
    let syllableCount: Int
    let absoluteDelta: Int
    let deltaLabel: String
    let rhymeLabel: String
    let feedback: String
    let endWord: String?
    let isCurrentLine: Bool
    let deltaColor: Color

    init(line: ParsedLine, targetCount: Int, rhymeMap: RhymeGroupMap, isCurrentLine: Bool) {
        let syllableCount = line.syllableCount ?? 0
        let delta = syllableCount - targetCount
        let absoluteDelta = abs(delta)

        self.id = line.index
        self.lineIndex = line.index
        self.displayLineNumber = line.index + 1
        self.syllableCount = syllableCount
        self.absoluteDelta = absoluteDelta
        self.deltaLabel = SongwritingAnalysisLineRow.deltaLabel(for: delta)
        self.rhymeLabel = rhymeMap[line.index].map { rhymeLetter(for: $0.groupId) } ?? "–"
        self.feedback = SongwritingAnalysisLineRow.feedback(delta: delta, targetCount: targetCount)
        self.endWord = line.endWord
        self.isCurrentLine = isCurrentLine
        self.deltaColor = SongwritingAnalysisLineRow.deltaColor(for: absoluteDelta)
    }

    private static func deltaLabel(for delta: Int) -> String {
        switch delta {
        case ..<0:
            return "\(delta)"
        case 0:
            return "On"
        default:
            return "+\(delta)"
        }
    }

    private static func feedback(delta: Int, targetCount: Int) -> String {
        switch delta {
        case ..<(-1):
            return "Short by \(-delta) against \(targetCount)"
        case -1:
            return "Slightly under"
        case 0:
            return "Right on target"
        case 1:
            return "Slightly over"
        default:
            return "Heavy by \(delta) syllables"
        }
    }

    private static func deltaColor(for absoluteDelta: Int) -> Color {
        switch absoluteDelta {
        case 0:
            return Theme.sectionColor(for: .bridge)
        case 1:
            return Theme.sectionColor(for: .chorus)
        default:
            return Theme.sectionColor(for: .preChorus)
        }
    }
}

private func rhymeLetter(for groupID: Int) -> String {
    let alphabet = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    if groupID < alphabet.count {
        return String(alphabet[groupID])
    }

    let prefixIndex = (groupID / alphabet.count) - 1
    let suffixIndex = groupID % alphabet.count
    let prefix = alphabet[max(0, min(prefixIndex, alphabet.count - 1))]
    let suffix = alphabet[suffixIndex]
    return String([prefix, suffix])
}

#Preview {
    SongwritingAnalysisPanel(
        bodyText: """
        We were talking to the ceiling all night
        Let the radio tell us what was right
        I can hear the city leaning into blue

        So take the spark and make it something true
        Turn the dark into a doorway we can use
        """,
        parsedLines: LineParser.parseLyricBody(
            """
            We were talking to the ceiling all night
            Let the radio tell us what was right
            I can hear the city leaning into blue

            So take the spark and make it something true
            Turn the dark into a doorway we can use
            """
        ),
        sectionTypes: [0: .verse, 4: .chorus],
        currentLineIndex: 4
    )
    .padding()
    .background(Theme.canvas)
}
