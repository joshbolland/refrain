import Foundation
import Supabase

final class ProjectRepository: Sendable {
    private let supabase = SupabaseService.shared.client
    private let tableName = "collections"
    private let assignmentsTableName = "collection_items"

    // MARK: - Project CRUD Operations

    func fetchAll() async throws -> [Project] {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        let rows: [Project.DatabaseRow] = try await supabase
            .from(tableName)
            .select()
            .eq("user_id", value: userId)
            .order("updated_at", ascending: false)
            .execute()
            .value

        return rows.map { Project(from: $0) }
    }

    func fetch(id: String) async throws -> Project? {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        let rows: [Project.DatabaseRow] = try await supabase
            .from(tableName)
            .select()
            .eq("id", value: id)
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value

        return rows.first.map { Project(from: $0) }
    }

    func create(_ project: Project) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .insert(project.toInsertRow(userId: userId))
            .execute()
    }

    func update(_ project: Project) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .update(project.toUpdateRow())
            .eq("id", value: project.id)
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
            .eq("user_id", value: userId)
            .execute()

        // Then delete the project
        try await supabase
            .from(tableName)
            .delete()
            .eq("id", value: id)
            .eq("user_id", value: userId)
            .execute()
    }

    // MARK: - Assignment Operations

    func fetchAllAssignments() async throws -> [ProjectAssignment] {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        // Fetch assignments for projects owned by the user
        let projects = try await fetchAll()
        let projectIds = projects.map { $0.id }

        guard !projectIds.isEmpty else {
            return []
        }

        let rows: [ProjectAssignment.DatabaseRow] = try await supabase
            .from(assignmentsTableName)
            .select()
            .eq("user_id", value: userId)
            .in("collection_id", values: projectIds)
            .execute()
            .value

        return rows.map { ProjectAssignment(from: $0) }
    }

    func fetchAssignments(for projectId: String) async throws -> [ProjectAssignment] {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        let rows: [ProjectAssignment.DatabaseRow] = try await supabase
            .from(assignmentsTableName)
            .select()
            .eq("user_id", value: userId)
            .eq("collection_id", value: projectId)
            .execute()
            .value

        return rows.map { ProjectAssignment(from: $0) }
    }

    func createAssignment(_ assignment: ProjectAssignment) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(assignmentsTableName)
            .insert(assignment.toInsertRow(userId: userId))
            .execute()
    }

    func deleteAssignment(projectId: String, itemId: String, itemType: ProjectItemType) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(assignmentsTableName)
            .delete()
            .eq("user_id", value: userId)
            .eq("collection_id", value: projectId)
            .eq("item_id", value: itemId)
            .eq("item_type", value: itemType.rawValue)
            .execute()
    }
}
