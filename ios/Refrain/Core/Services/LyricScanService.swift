import CoreGraphics
import Foundation
import ImageIO
import UIKit
import Vision
import VisionKit

struct LyricScanDraft: Identifiable, Equatable, Sendable {
    let id: UUID
    var title: String
    var body: String
    let pageCount: Int

    init(
        id: UUID = UUID(),
        title: String,
        body: String,
        pageCount: Int
    ) {
        self.id = id
        self.title = title
        self.body = body
        self.pageCount = pageCount
    }
}

enum LyricScanService {
    static var isSupported: Bool {
        VNDocumentCameraViewController.isSupported
    }

    static func recognizeText(from scan: VNDocumentCameraScan) async throws -> LyricScanDraft {
        let images = (0..<scan.pageCount).map { scan.imageOfPage(at: $0) }
        var pages: [String] = []
        pages.reserveCapacity(images.count)

        for image in images {
            let text = try await recognizeText(in: image)
            if !text.isEmpty {
                pages.append(text)
            }
        }

        let body = pages
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")

        guard !body.isEmpty else {
            throw LyricScanError.noTextFound
        }

        return LyricScanDraft(
            title: suggestedTitle(from: body),
            body: body,
            pageCount: scan.pageCount
        )
    }

    private static func recognizeText(in image: UIImage) async throws -> String {
        guard let cgImage = image.cgImage else {
            throw LyricScanError.invalidImage
        }

        return try await withCheckedThrowingContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let observations = request.results as? [VNRecognizedTextObservation] ?? []
                let text = recognizedText(from: observations)
                continuation.resume(returning: text)
            }

            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            request.recognitionLanguages = Array(Locale.preferredLanguages.prefix(3))

            let handler = VNImageRequestHandler(
                cgImage: cgImage,
                orientation: cgImageOrientation(for: image.imageOrientation)
            )

            do {
                try handler.perform([request])
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }

    private static func recognizedText(from observations: [VNRecognizedTextObservation]) -> String {
        let chunks = observations.compactMap { observation -> RecognizedChunk? in
            guard let candidate = observation.topCandidates(1).first else {
                return nil
            }

            let text = normalizeLine(candidate.string)
            guard !text.isEmpty else {
                return nil
            }

            return RecognizedChunk(
                text: text,
                midY: observation.boundingBox.midY,
                minX: observation.boundingBox.minX
            )
        }
        .sorted {
            if abs($0.midY - $1.midY) > 0.02 {
                return $0.midY > $1.midY
            }
            return $0.minX < $1.minX
        }

        guard !chunks.isEmpty else {
            return ""
        }

        // Group nearby text boxes onto the same lyric line before stitching pages together.
        var groupedLines: [RecognizedLine] = []

        for chunk in chunks {
            if let lastIndex = groupedLines.indices.last,
               abs(groupedLines[lastIndex].midY - chunk.midY) < 0.025 {
                groupedLines[lastIndex].segments.append(chunk)
                groupedLines[lastIndex].midY = (groupedLines[lastIndex].midY + chunk.midY) / 2
            } else {
                groupedLines.append(RecognizedLine(midY: chunk.midY, segments: [chunk]))
            }
        }

        return groupedLines
            .map { line in
                line.segments
                    .sorted { $0.minX < $1.minX }
                    .map(\.text)
                    .joined(separator: " ")
            }
            .map(normalizeLine)
            .filter { !$0.isEmpty }
            .joined(separator: "\n")
    }

    private static func suggestedTitle(from body: String) -> String {
        let firstLine = body
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty }

        guard let firstLine, firstLine.count >= 3, firstLine.count <= 48 else {
            return "Scanned Lyrics"
        }

        return firstLine
    }

    private static func normalizeLine(_ text: String) -> String {
        text
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func cgImageOrientation(for orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
        switch orientation {
        case .up:
            return .up
        case .upMirrored:
            return .upMirrored
        case .down:
            return .down
        case .downMirrored:
            return .downMirrored
        case .left:
            return .left
        case .leftMirrored:
            return .leftMirrored
        case .right:
            return .right
        case .rightMirrored:
            return .rightMirrored
        @unknown default:
            return .up
        }
    }
}

enum LyricScanError: LocalizedError {
    case invalidImage
    case noTextFound
    case scannerUnavailable

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            return "One of the scanned pages could not be processed."
        case .noTextFound:
            return "No readable text was found in that scan."
        case .scannerUnavailable:
            return "Document scanning is not available on this device."
        }
    }
}

private struct RecognizedChunk {
    let text: String
    let midY: CGFloat
    let minX: CGFloat
}

private struct RecognizedLine {
    var midY: CGFloat
    var segments: [RecognizedChunk]
}
