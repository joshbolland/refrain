import Foundation

enum SharedImportKind: String, Codable, Sendable {
    case lyricText
    case audioRecording
}

struct SharedImportRecord: Identifiable, Codable, Sendable {
    let id: String
    let kind: SharedImportKind
    let createdAt: Date
    let title: String?
    let originalFilename: String?
    let relativeFilePath: String
    let typeIdentifier: String?
}

struct PendingSharedImport: Identifiable, Sendable {
    let record: SharedImportRecord
    let fileURL: URL

    var id: String { record.id }
    var kind: SharedImportKind { record.kind }
    var title: String? { record.title }
    var originalFilename: String? { record.originalFilename }
    var typeIdentifier: String? { record.typeIdentifier }
}

enum SharedImportLocation {
    static let appGroupIdentifier = "group.com.refrain.app"
    static let sharedImportURL = URL(string: "refrain://shared-import")!
}

final class SharedImportStore {
    static let shared = SharedImportStore()

    private let fileManager = FileManager.default
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private init() {
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }

    func stageText(_ text: String, title: String? = nil) throws -> SharedImportRecord {
        let filename = sanitizedFilename(
            preferredTitle: title,
            fallback: "Shared Note"
        )

        return try stageData(
            Data(text.utf8),
            kind: .lyricText,
            fileExtension: "txt",
            title: title,
            originalFilename: "\(filename).txt",
            typeIdentifier: "public.plain-text"
        )
    }

    func stageFileCopy(
        from sourceURL: URL,
        kind: SharedImportKind,
        title: String? = nil,
        typeIdentifier: String? = nil
    ) throws -> SharedImportRecord {
        let record = SharedImportRecord(
            id: UUID().uuidString,
            kind: kind,
            createdAt: Date(),
            title: title,
            originalFilename: sourceURL.lastPathComponent,
            relativeFilePath: "",
            typeIdentifier: typeIdentifier
        )

        let itemDirectory = try createItemDirectory(for: record.id)
        let destinationFilename = sanitizedFilename(
            preferredTitle: title ?? sourceURL.deletingPathExtension().lastPathComponent,
            fallback: "Shared File"
        ) + fileExtensionSuffix(for: sourceURL.pathExtension)
        let destinationURL = itemDirectory.appendingPathComponent(destinationFilename)

        if fileManager.fileExists(atPath: destinationURL.path) {
            try fileManager.removeItem(at: destinationURL)
        }
        try fileManager.copyItem(at: sourceURL, to: destinationURL)

        let finalizedRecord = SharedImportRecord(
            id: record.id,
            kind: kind,
            createdAt: record.createdAt,
            title: title,
            originalFilename: sourceURL.lastPathComponent,
            relativeFilePath: itemRelativePath(for: record.id, filename: destinationFilename),
            typeIdentifier: typeIdentifier
        )

        try writeManifest(finalizedRecord, in: itemDirectory)
        return finalizedRecord
    }

    func pendingItems() throws -> [PendingSharedImport] {
        let rootURL = try sharedImportsRootDirectory()
        let directoryContents = try fileManager.contentsOfDirectory(
            at: rootURL,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        )

        return try directoryContents.compactMap { itemURL in
            let manifestURL = itemURL.appendingPathComponent("manifest.json")
            guard fileManager.fileExists(atPath: manifestURL.path) else {
                return nil
            }

            let manifestData = try Data(contentsOf: manifestURL)
            let record = try decoder.decode(SharedImportRecord.self, from: manifestData)
            let fileURL = rootURL.appendingPathComponent(record.relativeFilePath)
            guard fileManager.fileExists(atPath: fileURL.path) else {
                return nil
            }

            return PendingSharedImport(record: record, fileURL: fileURL)
        }
        .sorted { $0.record.createdAt < $1.record.createdAt }
    }

    func removeItem(id: String) throws {
        let itemDirectory = try sharedImportsRootDirectory().appendingPathComponent(id, isDirectory: true)
        guard fileManager.fileExists(atPath: itemDirectory.path) else {
            return
        }

        try fileManager.removeItem(at: itemDirectory)
    }

    private func stageData(
        _ data: Data,
        kind: SharedImportKind,
        fileExtension: String,
        title: String?,
        originalFilename: String?,
        typeIdentifier: String?
    ) throws -> SharedImportRecord {
        let record = SharedImportRecord(
            id: UUID().uuidString,
            kind: kind,
            createdAt: Date(),
            title: title,
            originalFilename: originalFilename,
            relativeFilePath: "",
            typeIdentifier: typeIdentifier
        )

        let itemDirectory = try createItemDirectory(for: record.id)
        let filename = sanitizedFilename(
            preferredTitle: title,
            fallback: kind == .lyricText ? "Shared Note" : "Shared Audio"
        ) + fileExtensionSuffix(for: fileExtension)
        let fileURL = itemDirectory.appendingPathComponent(filename)

        try data.write(to: fileURL, options: .atomic)

        let finalizedRecord = SharedImportRecord(
            id: record.id,
            kind: kind,
            createdAt: record.createdAt,
            title: title,
            originalFilename: originalFilename,
            relativeFilePath: itemRelativePath(for: record.id, filename: filename),
            typeIdentifier: typeIdentifier
        )

        try writeManifest(finalizedRecord, in: itemDirectory)
        return finalizedRecord
    }

    private func sharedImportsRootDirectory() throws -> URL {
        guard let containerURL = fileManager.containerURL(
            forSecurityApplicationGroupIdentifier: SharedImportLocation.appGroupIdentifier
        ) else {
            throw SharedImportStoreError.appGroupUnavailable
        }

        let rootURL = containerURL.appendingPathComponent("SharedImports", isDirectory: true)
        if !fileManager.fileExists(atPath: rootURL.path) {
            try fileManager.createDirectory(at: rootURL, withIntermediateDirectories: true)
        }
        return rootURL
    }

    private func createItemDirectory(for id: String) throws -> URL {
        let itemDirectory = try sharedImportsRootDirectory().appendingPathComponent(id, isDirectory: true)
        if !fileManager.fileExists(atPath: itemDirectory.path) {
            try fileManager.createDirectory(at: itemDirectory, withIntermediateDirectories: true)
        }
        return itemDirectory
    }

    private func writeManifest(_ record: SharedImportRecord, in directory: URL) throws {
        let manifestURL = directory.appendingPathComponent("manifest.json")
        let data = try encoder.encode(record)
        try data.write(to: manifestURL, options: .atomic)
    }

    private func itemRelativePath(for id: String, filename: String) -> String {
        "\(id)/\(filename)"
    }

    private func sanitizedFilename(preferredTitle: String?, fallback: String) -> String {
        let trimmed = preferredTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let base = trimmed.isEmpty ? fallback : trimmed

        let invalidCharacters = CharacterSet(charactersIn: "/:\\?%*|\"<>")
        let sanitizedScalars = base.unicodeScalars.map { scalar in
            invalidCharacters.contains(scalar) ? "_" : Character(scalar)
        }

        let sanitized = String(sanitizedScalars)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return sanitized.isEmpty ? fallback : sanitized
    }

    private func fileExtensionSuffix(for pathExtension: String) -> String {
        let trimmed = pathExtension.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return ""
        }

        return "." + trimmed
    }
}

enum SharedImportStoreError: LocalizedError {
    case appGroupUnavailable

    var errorDescription: String? {
        switch self {
        case .appGroupUnavailable:
            return "The shared import container is unavailable."
        }
    }
}
