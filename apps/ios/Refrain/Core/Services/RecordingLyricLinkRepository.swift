import Foundation
import Supabase

final class RecordingLyricLinkRepository: Sendable {
    private let supabase = SupabaseService.shared.client
    private let tableName = "recording_lyric_links"

    func fetchAll() async throws -> [RecordingLyricLink] {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        let rows: [RecordingLyricLink.DatabaseRow] = try await supabase
            .from(tableName)
            .select()
            .eq("user_id", value: userId)
            .order("created_at", ascending: false)
            .execute()
            .value

        return rows.map { RecordingLyricLink(from: $0) }
    }

    func create(_ link: RecordingLyricLink) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .insert(link.toInsertRow(userId: userId))
            .execute()
    }

    func delete(_ link: RecordingLyricLink) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .delete()
            .eq("user_id", value: userId)
            .eq("id", value: link.id)
            .execute()
    }

    func delete(recordingId: String, lyricFileId: String) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .delete()
            .eq("user_id", value: userId)
            .eq("recording_id", value: recordingId)
            .eq("lyric_file_id", value: lyricFileId)
            .execute()
    }

    func deleteAll(forRecordingId recordingId: String) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .delete()
            .eq("user_id", value: userId)
            .eq("recording_id", value: recordingId)
            .execute()
    }

    func deleteAll(forLyricFileId lyricFileId: String) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .delete()
            .eq("user_id", value: userId)
            .eq("lyric_file_id", value: lyricFileId)
            .execute()
    }
}
