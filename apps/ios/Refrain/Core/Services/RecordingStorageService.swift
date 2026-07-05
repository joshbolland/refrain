import Foundation
import Supabase
import UniformTypeIdentifiers

final class RecordingStorageService: Sendable {
    static let shared = RecordingStorageService()

    private let supabase = SupabaseService.shared.client
    private let bucketName = "recordings"

    private init() {}

    func storagePath(for recordingId: String, userId: String, fileExtension: String = "m4a") -> String {
        let normalizedUserId = userId.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let sanitizedExtension = fileExtension.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalExtension = sanitizedExtension.isEmpty ? "m4a" : sanitizedExtension
        return "users/\(normalizedUserId)/\(recordingId).\(finalExtension)"
    }

    func uploadRecording(
        from localFileURL: URL,
        recordingId: String,
        userId: String,
        preferredFileExtension: String? = nil,
        contentType: String? = nil
    ) async throws -> String {
        let pathExtension = preferredFileExtension?.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalExtension = pathExtension?.isEmpty == false ? pathExtension! : localFileURL.pathExtension
        let path = storagePath(
            for: recordingId,
            userId: userId,
            fileExtension: finalExtension.isEmpty ? "m4a" : finalExtension
        )
        let data = try Data(contentsOf: localFileURL)
        let resolvedContentType = normalizedContentType(contentType, for: localFileURL)

        try await supabase.storage
            .from(bucketName)
            .upload(
                path,
                data: data,
                options: FileOptions(
                    cacheControl: "3600",
                    contentType: resolvedContentType,
                    upsert: false
                )
            )

        return path
    }

    func deleteRecording(at path: String) async throws {
        guard isRemoteStoragePath(path) else { return }

        try await supabase.storage
            .from(bucketName)
            .remove(paths: [path])

        try? removeCachedFile(for: path)
    }

    func resolvePlaybackURL(for storedValue: String) async throws -> URL {
        if let localURL = localFileURL(from: storedValue), FileManager.default.fileExists(atPath: localURL.path) {
            return localURL
        }

        let cachedURL = cacheURL(for: storedValue)
        if FileManager.default.fileExists(atPath: cachedURL.path) {
            return cachedURL
        }

        let data = try await supabase.storage
            .from(bucketName)
            .download(path: storedValue)

        try createCacheDirectoryIfNeeded()
        try data.write(to: cachedURL, options: .atomic)
        return cachedURL
    }

    func isRemoteStoragePath(_ value: String) -> Bool {
        localFileURL(from: value) == nil && !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func localFileURL(from value: String) -> URL? {
        if let url = URL(string: value), url.isFileURL {
            return url
        }

        if value.hasPrefix("/") {
            return URL(fileURLWithPath: value)
        }

        return nil
    }

    private func cacheURL(for storagePath: String) -> URL {
        recordingsCacheDirectory().appendingPathComponent(storagePath.replacingOccurrences(of: "/", with: "_"))
    }

    private func recordingsCacheDirectory() -> URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("RecordingCache", isDirectory: true)
    }

    private func createCacheDirectoryIfNeeded() throws {
        try FileManager.default.createDirectory(
            at: recordingsCacheDirectory(),
            withIntermediateDirectories: true
        )
    }

    private func removeCachedFile(for storagePath: String) throws {
        let cachedURL = cacheURL(for: storagePath)
        guard FileManager.default.fileExists(atPath: cachedURL.path) else { return }
        try FileManager.default.removeItem(at: cachedURL)
    }

    private func mimeType(for fileURL: URL) -> String {
        if fileURL.pathExtension.caseInsensitiveCompare("m4a") == .orderedSame {
            return "audio/mp4"
        }

        guard
            !fileURL.pathExtension.isEmpty,
            let type = UTType(filenameExtension: fileURL.pathExtension),
            let mimeType = type.preferredMIMEType
        else {
            return "audio/mp4"
        }

        return normalizedMimeType(mimeType)
    }

    private func normalizedContentType(_ contentType: String?, for fileURL: URL) -> String {
        if let contentType {
            return normalizedMimeType(contentType)
        }

        return mimeType(for: fileURL)
    }

    private func normalizedMimeType(_ mimeType: String) -> String {
        switch mimeType.lowercased() {
        case "audio/x-m4a", "audio/m4a":
            return "audio/mp4"
        case "audio/x-wav":
            return "audio/wav"
        default:
            return mimeType.lowercased()
        }
    }
}
