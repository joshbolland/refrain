import Foundation
import Supabase

final class CollectionRepository: Sendable {
    private let supabase = SupabaseService.shared.client
    private let tableName = "collections"
    private let assignmentsTableName = "collection_assignments"

    // MARK: - Collection CRUD Operations

    func fetchAll() async throws -> [Collection] {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        let rows: [Collection.DatabaseRow] = try await supabase
            .from(tableName)
            .select()
            .eq("user_id", value: userId)
            .order("updated_at", ascending: false)
            .execute()
            .value

        return rows.map { Collection(from: $0) }
    }

    func fetch(id: String) async throws -> Collection? {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        let rows: [Collection.DatabaseRow] = try await supabase
            .from(tableName)
            .select()
            .eq("id", value: id)
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value

        return rows.first.map { Collection(from: $0) }
    }

    func create(_ collection: Collection) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .insert(collection.toInsertRow(userId: userId))
            .execute()
    }

    func update(_ collection: Collection) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .update(collection.toInsertRow(userId: userId))
            .eq("id", value: collection.id)
            .eq("user_id", value: userId)
            .execute()
    }

    func delete(_ id: String) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        // Delete all assignments first
        try await supabase
            .from(assignmentsTableName)
            .delete()
            .eq("collection_id", value: id)
            .execute()

        // Then delete the collection
        try await supabase
            .from(tableName)
            .delete()
            .eq("id", value: id)
            .eq("user_id", value: userId)
            .execute()
    }

    // MARK: - Assignment Operations

    func fetchAllAssignments() async throws -> [CollectionAssignment] {
        guard await AuthService.shared.getCurrentUserId() != nil else {
            throw RepositoryError.notAuthenticated
        }

        // Fetch assignments for collections owned by the user
        let collections = try await fetchAll()
        let collectionIds = collections.map { $0.id }

        guard !collectionIds.isEmpty else {
            return []
        }

        let rows: [CollectionAssignment.DatabaseRow] = try await supabase
            .from(assignmentsTableName)
            .select()
            .in("collection_id", values: collectionIds)
            .execute()
            .value

        return rows.map { CollectionAssignment(from: $0) }
    }

    func fetchAssignments(for collectionId: String) async throws -> [CollectionAssignment] {
        let rows: [CollectionAssignment.DatabaseRow] = try await supabase
            .from(assignmentsTableName)
            .select()
            .eq("collection_id", value: collectionId)
            .execute()
            .value

        return rows.map { CollectionAssignment(from: $0) }
    }

    func createAssignment(_ assignment: CollectionAssignment) async throws {
        try await supabase
            .from(assignmentsTableName)
            .insert(assignment.toInsertRow())
            .execute()
    }

    func deleteAssignment(collectionId: String, itemId: String) async throws {
        try await supabase
            .from(assignmentsTableName)
            .delete()
            .eq("collection_id", value: collectionId)
            .eq("item_id", value: itemId)
            .execute()
    }
}
