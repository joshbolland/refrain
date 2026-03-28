import Foundation

enum LibraryItem: Identifiable, Equatable, Hashable, Sendable {
    case lyric(LyricFile)
    case recording(Recording)

    var id: String {
        switch self {
        case .lyric(let file): return file.id
        case .recording(let recording): return recording.id
        }
    }

    var title: String {
        switch self {
        case .lyric(let file): return file.title
        case .recording(let recording): return recording.title
        }
    }

    var createdAt: Date {
        switch self {
        case .lyric(let file): return file.createdAt
        case .recording(let recording): return recording.createdAt
        }
    }

    var updatedAt: Date {
        switch self {
        case .lyric(let file): return file.updatedAt
        case .recording(let recording): return recording.updatedAt
        }
    }

    var itemType: CollectionItemType {
        switch self {
        case .lyric: return .lyric
        case .recording: return .recording
        }
    }

    var isLyric: Bool {
        if case .lyric = self { return true }
        return false
    }

    var isRecording: Bool {
        if case .recording = self { return true }
        return false
    }
}
