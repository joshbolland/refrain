import SwiftUI
import Supabase
import AVFoundation
import UniformTypeIdentifiers

enum LibraryItemTypeFilter: String, CaseIterable, Identifiable, Sendable {
    case all
    case lyrics
    case recordings

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all:
            return "All"
        case .lyrics:
            return "Lyrics"
        case .recordings:
            return "Recordings"
        }
    }
}

enum LibrarySortOption: String, CaseIterable, Identifiable, Sendable {
    case recentlyUpdated
    case recentlyCreated
    case title
    case favoritesFirst

    var id: String { rawValue }

    var label: String {
        switch self {
        case .recentlyUpdated:
            return "Recently Updated"
        case .recentlyCreated:
            return "Recently Created"
        case .title:
            return "Title"
        case .favoritesFirst:
            return "Favorites First"
        }
    }
}

enum LibraryArchiveFilter: String, CaseIterable, Identifiable, Sendable {
    case activeOnly
    case archivedOnly
    case all

    var id: String { rawValue }

    var label: String {
        switch self {
        case .activeOnly:
            return "Active"
        case .archivedOnly:
            return "Archived"
        case .all:
            return "All"
        }
    }
}

struct LibraryItemMetadata: Codable, Equatable, Sendable {
    var isFavorite = false
    var isArchived = false
}

struct SharedImportFeedback: Sendable {
    let items: [LibraryItem]

    var count: Int { items.count }
    var latestItem: LibraryItem? { items.last }

    var message: String {
        count == 1 ? "Imported 1 item from share." : "Imported \(count) items from share."
    }
}

@Observable
final class AppState {
    private static let libraryMetadataDefaultsKey = "refrain.library.item.metadata"

    // MARK: - User State
    var currentUser: User?
    var isLoading = true

    // MARK: - Library State
    var lyricFiles: [LyricFile] = []
    var recordings: [Recording] = []
    var projects: [Project] = []
    var projectAssignments: [ProjectAssignment] = []
    var recordingLyricLinks: [RecordingLyricLink] = []

    // MARK: - Filter State
    var searchQuery = ""
    var selectedProjectFilter: Project.ID?
    var selectedItemTypeFilter: LibraryItemTypeFilter = .all
    var librarySortOption: LibrarySortOption = .recentlyUpdated
    var archiveFilter: LibraryArchiveFilter = .activeOnly

    // MARK: - Local Library Metadata
    var itemMetadataById: [String: LibraryItemMetadata] = [:]

    // MARK: - UI State
    var selectedTab: MainTab = .library
    var pendingLibrarySelection: LibraryItem?
    var sharedImportFeedback: SharedImportFeedback?

    // MARK: - Services
    private let authService = AuthService.shared
    private let lyricRepository = LyricRepository()
    private let recordingRepository = RecordingRepository()
    private let projectRepository = ProjectRepository()
    private let recordingLyricLinkRepository = RecordingLyricLinkRepository()
    private let recordingStorageService = RecordingStorageService.shared

    // MARK: - Initialization

    init() {
        loadLibraryMetadata()
    }

    func initialize() async {
        isLoading = true
        defer { isLoading = false }

        // Check for existing session
        if let user = await authService.getCurrentUser() {
            currentUser = user
            await loadAllData()
            await importSharedItemsIfNeeded()
        }

        // Listen for auth state changes
        Task {
            for await state in authService.authStateChanges {
                await MainActor.run {
                    self.currentUser = state.user
                }
                if state.user != nil {
                    await loadAllData()
                    await importSharedItemsIfNeeded()
                } else {
                    await MainActor.run {
                        clearData()
                    }
                }
            }
        }
    }

    // MARK: - OAuth Callback Handling

    func handleOpenURL(_ url: URL) async {
        guard url.scheme == Config.oauthCallbackScheme else {
            return
        }

        if url.host == "auth" {
            do {
                let user = try await authService.handleOAuthCallback(url: url)
                await MainActor.run {
                    self.currentUser = user
                }
            } catch {
                print("Error handling OAuth callback: \(error)")
            }
            return
        }

        if url.host == "shared-import" {
            await importSharedItemsIfNeeded()
        }
    }

    // MARK: - Data Loading

    func loadAllData() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadLyricFiles() }
            group.addTask { await self.loadRecordings() }
            group.addTask { await self.loadProjects() }
            group.addTask { await self.loadProjectAssignments() }
            group.addTask { await self.loadRecordingLyricLinks() }
        }
    }

    @MainActor
    private func clearData() {
        lyricFiles = []
        recordings = []
        projects = []
        projectAssignments = []
        recordingLyricLinks = []
    }

    func loadLyricFiles() async {
        do {
            let files = try await lyricRepository.fetchAll()
            await MainActor.run {
                self.lyricFiles = files
            }
        } catch {
            print("Error loading lyric files: \(error)")
        }
    }

    func loadRecordings() async {
        do {
            let items = try await recordingRepository.fetchAll()
            await MainActor.run {
                self.recordings = items
            }
        } catch {
            print("Error loading recordings: \(error)")
        }
    }

    func loadProjects() async {
        do {
            let items = try await projectRepository.fetchAll()
            await MainActor.run {
                self.projects = items
            }
        } catch {
            print("Error loading projects: \(error)")
        }
    }

    func loadProjectAssignments() async {
        do {
            let items = try await projectRepository.fetchAllAssignments()
            await MainActor.run {
                self.projectAssignments = items
            }
        } catch {
            print("Error loading project assignments: \(error)")
        }
    }

    func loadRecordingLyricLinks() async {
        do {
            let items = try await recordingLyricLinkRepository.fetchAll()
            await MainActor.run {
                self.recordingLyricLinks = items
            }
        } catch {
            print("Error loading recording lyric links: \(error)")
        }
    }

    func importSharedItemsIfNeeded() async {
        guard currentUser != nil else {
            return
        }

        let pendingItems: [PendingSharedImport]
        do {
            pendingItems = try SharedImportStore.shared.pendingItems()
        } catch {
            print("Error loading shared imports: \(error)")
            return
        }

        guard !pendingItems.isEmpty else {
            return
        }

        var importedItems: [LibraryItem] = []

        for item in pendingItems {
            do {
                switch item.kind {
                case .lyricText:
                    let importedItem = try await importSharedLyric(item)
                    importedItems.append(importedItem)
                case .audioRecording:
                    let importedItem = try await importSharedRecording(item)
                    importedItems.append(importedItem)
                }

                try SharedImportStore.shared.removeItem(id: item.id)
            } catch {
                print("Error importing shared item \(item.id): \(error)")
            }
        }

        guard !importedItems.isEmpty else {
            return
        }

        let finalizedImportedItems = importedItems

        await MainActor.run {
            selectedTab = .library
            sharedImportFeedback = SharedImportFeedback(items: finalizedImportedItems)
            pendingLibrarySelection = finalizedImportedItems.count == 1 ? finalizedImportedItems[0] : nil
        }
    }

    // MARK: - Computed Properties

    var filteredLibraryItems: [LibraryItem] {
        var items: [LibraryItem] = lyricFiles.map { .lyric($0) } + recordings.map { .recording($0) }

        // Apply search filter
        if !searchQuery.isEmpty {
            let query = searchQuery.lowercased()
            items = items.filter { item in
                switch item {
                case .lyric(let file):
                    return file.title.lowercased().contains(query) ||
                           file.body.lowercased().contains(query)
                case .recording(let recording):
                    return recording.title.lowercased().contains(query)
                }
            }
        }

        // Apply project filter
        if let projectId = selectedProjectFilter {
            let itemIdsInProject = Set(
                projectAssignments
                    .filter { $0.projectId == projectId }
                    .map { $0.itemId }
            )
            items = items.filter { itemIdsInProject.contains($0.id) }
        }

        if selectedItemTypeFilter != .all {
            items = items.filter { item in
                switch selectedItemTypeFilter {
                case .lyrics:
                    return item.isLyric
                case .recordings:
                    return item.isRecording
                case .all:
                    return true
                }
            }
        }

        switch archiveFilter {
        case .activeOnly:
            items = items.filter { !metadata(for: $0).isArchived }
        case .archivedOnly:
            items = items.filter { metadata(for: $0).isArchived }
        case .all:
            break
        }

        return sortLibraryItems(items)
    }

    var allLibraryItems: [LibraryItem] {
        let items = lyricFiles.map { LibraryItem.lyric($0) } + recordings.map { LibraryItem.recording($0) }
        return sortLibraryItems(items)
    }

    func metadata(for item: LibraryItem) -> LibraryItemMetadata {
        itemMetadataById[item.id] ?? LibraryItemMetadata()
    }

    func isFavorite(_ item: LibraryItem) -> Bool {
        metadata(for: item).isFavorite
    }

    func isArchived(_ item: LibraryItem) -> Bool {
        metadata(for: item).isArchived
    }

    // MARK: - Recording/Lyric Link Operations

    func linkedItems(for item: LibraryItem) -> [LibraryItem] {
        switch item {
        case .lyric(let file):
            return linkedRecordings(for: file).map { .recording($0) }
        case .recording(let recording):
            return linkedLyrics(for: recording).map { .lyric($0) }
        }
    }

    func linkedLyrics(for recording: Recording) -> [LyricFile] {
        let lyricById = Dictionary(uniqueKeysWithValues: lyricFiles.map { ($0.id, $0) })
        return recordingLyricLinks
            .filter { $0.recordingId == recording.id }
            .sorted { $0.createdAt < $1.createdAt }
            .compactMap { lyricById[$0.lyricFileId] }
    }

    func linkedRecordings(for file: LyricFile) -> [Recording] {
        let recordingById = Dictionary(uniqueKeysWithValues: recordings.map { ($0.id, $0) })
        return recordingLyricLinks
            .filter { $0.lyricFileId == file.id }
            .sorted { $0.createdAt < $1.createdAt }
            .compactMap { recordingById[$0.recordingId] }
    }

    func linkCandidates(for item: LibraryItem) -> [LibraryItem] {
        let linkedIds = Set(linkedItems(for: item).map(\.id))

        switch item {
        case .lyric:
            return sortLibraryItems(
                recordings
                    .filter { !linkedIds.contains($0.id) }
                    .map { .recording($0) }
            )
        case .recording:
            return sortLibraryItems(
                lyricFiles
                    .filter { !linkedIds.contains($0.id) }
                    .map { .lyric($0) }
            )
        }
    }

    func linkedItemsNotInProject(for item: LibraryItem, project: Project) -> [LibraryItem] {
        let existingItemIds = Set(itemsInProject(project).map(\.id))
        return linkedItems(for: item).filter { !existingItemIds.contains($0.id) }
    }

    func itemsToAddToProject(
        _ items: [LibraryItem],
        project: Project,
        includeLinkedItems: Bool
    ) -> [LibraryItem] {
        guard includeLinkedItems else {
            return uniqueLibraryItems(items)
        }

        let existingItemIds = Set(itemsInProject(project).map(\.id))
        var expandedItems = items

        for item in items {
            expandedItems.append(contentsOf: linkedItems(for: item).filter { linkedItem in
                !existingItemIds.contains(linkedItem.id)
            })
        }

        return uniqueLibraryItems(expandedItems)
    }

    @discardableResult
    func linkRecording(_ recording: Recording, to lyricFile: LyricFile) async -> RecordingLyricLink? {
        if let existingLink = recordingLyricLinks.first(where: {
            $0.recordingId == recording.id && $0.lyricFileId == lyricFile.id
        }) {
            return existingLink
        }

        let link = RecordingLyricLink(
            id: UUID().uuidString,
            recordingId: recording.id,
            lyricFileId: lyricFile.id,
            createdAt: Date()
        )

        do {
            try await recordingLyricLinkRepository.create(link)
            await MainActor.run {
                self.recordingLyricLinks.insert(link, at: 0)
            }
            return link
        } catch {
            print("Error linking recording and lyric: \(error)")
            return nil
        }
    }

    @discardableResult
    func link(_ sourceItem: LibraryItem, to targetItem: LibraryItem) async -> RecordingLyricLink? {
        switch (sourceItem, targetItem) {
        case (.recording(let recording), .lyric(let file)):
            return await linkRecording(recording, to: file)
        case (.lyric(let file), .recording(let recording)):
            return await linkRecording(recording, to: file)
        default:
            return nil
        }
    }

    func deleteRecordingLyricLink(_ link: RecordingLyricLink) async {
        do {
            try await recordingLyricLinkRepository.delete(link)
            await MainActor.run {
                self.recordingLyricLinks.removeAll { $0.id == link.id }
            }
        } catch {
            print("Error deleting recording lyric link: \(error)")
        }
    }

    // MARK: - Direct File Import Operations

    func importLyricFile(from fileURL: URL) async throws -> LyricFile {
        try await importLyricFile(
            from: fileURL,
            preferredTitle: nil,
            fallbackTitle: "Imported Lyrics"
        )
    }

    func importRecordingFile(from fileURL: URL) async throws -> Recording {
        try await importRecordingFile(
            from: fileURL,
            preferredTitle: nil,
            preferredContentType: contentType(for: fileURL),
            fallbackTitle: "Imported Recording"
        )
    }

    // MARK: - Lyric File Operations

    func createLyricFile(
        title: String = "Untitled",
        body: String = "",
        sectionTypes: [Int: SectionType] = [:]
    ) async -> LyricFile? {
        let file = LyricFile(
            id: UUID().uuidString,
            title: title,
            body: body,
            createdAt: Date(),
            updatedAt: Date(),
            sectionTypes: sectionTypes
        )

        do {
            try await lyricRepository.create(file)
            await MainActor.run {
                self.lyricFiles.insert(file, at: 0)
            }
            return file
        } catch {
            print("Error creating lyric file: \(error)")
            return nil
        }
    }

    func updateLyricFile(_ file: LyricFile) async {
        var updated = file
        updated.updatedAt = Date()
        let finalUpdated = updated

        do {
            try await lyricRepository.update(finalUpdated)
            await MainActor.run {
                if let index = self.lyricFiles.firstIndex(where: { $0.id == file.id }) {
                    self.lyricFiles[index] = finalUpdated
                }
            }
        } catch {
            print("Error updating lyric file: \(error)")
        }
    }

    func duplicateLyricFile(_ file: LyricFile) async -> LyricFile? {
        let duplicate = LyricFile(
            id: UUID().uuidString,
            title: uniqueDuplicateTitle(for: file.title, existingTitles: lyricFiles.map(\.title)),
            body: file.body,
            createdAt: Date(),
            updatedAt: Date(),
            sectionTypes: file.sectionTypes
        )

        do {
            try await lyricRepository.create(duplicate)
            await MainActor.run {
                self.lyricFiles.insert(duplicate, at: 0)
            }
            return duplicate
        } catch {
            print("Error duplicating lyric file: \(error)")
            return nil
        }
    }

    func deleteLyricFile(_ file: LyricFile) async {
        do {
            try await recordingLyricLinkRepository.deleteAll(forLyricFileId: file.id)
        } catch {
            print("Error deleting lyric links: \(error)")
        }

        do {
            try await lyricRepository.delete(file.id)
            await MainActor.run {
                self.removeLocalStateForDeletedLyricFile(id: file.id)
            }
        } catch {
            print("Error deleting lyric file: \(error)")
        }
    }

    // MARK: - Recording Operations

    func createRecording(
        id: String = UUID().uuidString,
        title: String,
        uri: String,
        durationMs: Int
    ) async -> Recording? {
        let recording = Recording(
            id: id,
            title: title,
            createdAt: Date(),
            updatedAt: Date(),
            durationMs: durationMs,
            uri: uri
        )

        do {
            try await recordingRepository.create(recording)
            await MainActor.run {
                self.recordings.insert(recording, at: 0)
            }
            return recording
        } catch {
            print("Error creating recording: \(error)")
            return nil
        }
    }

    func updateRecording(_ recording: Recording) async {
        var updated = recording
        updated.updatedAt = Date()
        let finalUpdated = updated

        do {
            try await recordingRepository.update(finalUpdated)
            await MainActor.run {
                if let index = self.recordings.firstIndex(where: { $0.id == recording.id }) {
                    self.recordings[index] = finalUpdated
                }
            }
        } catch {
            print("Error updating recording: \(error)")
        }
    }

    func duplicateRecording(_ recording: Recording) async -> Recording? {
        let duplicate = Recording(
            id: UUID().uuidString,
            title: uniqueDuplicateTitle(for: recording.title, existingTitles: recordings.map(\.title)),
            createdAt: Date(),
            updatedAt: Date(),
            durationMs: recording.durationMs,
            uri: recording.uri
        )

        do {
            try await recordingRepository.create(duplicate)
            await MainActor.run {
                self.recordings.insert(duplicate, at: 0)
            }
            return duplicate
        } catch {
            print("Error duplicating recording: \(error)")
            return nil
        }
    }

    func deleteRecording(_ recording: Recording) async {
        do {
            try await recordingLyricLinkRepository.deleteAll(forRecordingId: recording.id)
        } catch {
            print("Error deleting recording links: \(error)")
        }

        if recordingStorageService.isRemoteStoragePath(recording.uri) {
            do {
                try await recordingStorageService.deleteRecording(at: recording.uri)
            } catch {
                print("Error deleting recording audio file: \(error)")
            }
        }

        do {
            try await recordingRepository.delete(recording.id)
            await MainActor.run {
                self.removeLocalStateForDeletedRecording(id: recording.id)
            }
        } catch {
            print("Error deleting recording: \(error)")
        }
    }

    func renameItem(_ item: LibraryItem, to title: String) async {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else { return }

        switch item {
        case .lyric(var file):
            file.title = trimmedTitle
            await updateLyricFile(file)
        case .recording(var recording):
            recording.title = trimmedTitle
            await updateRecording(recording)
        }
    }

    func duplicateItem(_ item: LibraryItem) async -> LibraryItem? {
        switch item {
        case .lyric(let file):
            guard let duplicate = await duplicateLyricFile(file) else { return nil }
            return .lyric(duplicate)
        case .recording(let recording):
            guard let duplicate = await duplicateRecording(recording) else { return nil }
            return .recording(duplicate)
        }
    }

    func deleteItems(_ items: [LibraryItem]) async {
        for item in items {
            switch item {
            case .lyric(let file):
                await deleteLyricFile(file)
            case .recording(let recording):
                await deleteRecording(recording)
            }
        }
    }

    func removeLocalStateForDeletedLyricFile(id: String) {
        lyricFiles.removeAll { $0.id == id }
        projectAssignments.removeAll { $0.itemType == .lyric && $0.itemId == id }
        recordingLyricLinks.removeAll { $0.lyricFileId == id }
        removeMetadata(forItemId: id)
    }

    func removeLocalStateForDeletedRecording(id: String) {
        recordings.removeAll { $0.id == id }
        projectAssignments.removeAll { $0.itemType == .recording && $0.itemId == id }
        recordingLyricLinks.removeAll { $0.recordingId == id }
        removeMetadata(forItemId: id)
    }

    func deleteCurrentAccountData() async {
        let recordingsToDelete = recordings
        let lyricFilesToDelete = lyricFiles
        let projectsToDelete = projects

        for recording in recordingsToDelete {
            await deleteRecording(recording)
        }

        for file in lyricFilesToDelete {
            await deleteLyricFile(file)
        }

        for project in projectsToDelete {
            await deleteProject(project)
        }
    }

    func setFavorite(_ isFavorite: Bool, for item: LibraryItem) {
        setFavorite(isFavorite, for: [item])
    }

    func setFavorite(_ isFavorite: Bool, for items: [LibraryItem]) {
        mutateMetadata(for: items) { metadata in
            metadata.isFavorite = isFavorite
        }
    }

    func setArchived(_ isArchived: Bool, for item: LibraryItem) {
        setArchived(isArchived, for: [item])
    }

    func setArchived(_ isArchived: Bool, for items: [LibraryItem]) {
        mutateMetadata(for: items) { metadata in
            metadata.isArchived = isArchived
        }
    }

    // MARK: - Project Operations

    func createProject(title: String, description: String? = nil) async -> Project? {
        let project = Project(
            id: UUID().uuidString,
            title: title,
            description: description,
            createdAt: Date(),
            updatedAt: Date()
        )

        do {
            try await projectRepository.create(project)
            await MainActor.run {
                self.projects.insert(project, at: 0)
            }
            return project
        } catch {
            print("Error creating project: \(error)")
            return nil
        }
    }

    func updateProject(_ project: Project) async {
        var updated = project
        updated.updatedAt = Date()
        let finalUpdated = updated

        do {
            try await projectRepository.update(finalUpdated)
            await MainActor.run {
                if let index = self.projects.firstIndex(where: { $0.id == project.id }) {
                    self.projects[index] = finalUpdated
                }
            }
        } catch {
            print("Error updating project: \(error)")
        }
    }

    func deleteProject(_ project: Project) async {
        do {
            try await projectRepository.delete(project.id)
            await MainActor.run {
                self.projects.removeAll { $0.id == project.id }
                self.projectAssignments.removeAll { $0.projectId == project.id }
            }
        } catch {
            print("Error deleting project: \(error)")
        }
    }

    // MARK: - Project Assignment Operations

    @discardableResult
    func addToProject(_ item: LibraryItem, project: Project, includeLinkedItems: Bool = false) async -> Bool {
        var didSucceed = await addSingleItemToProject(item, project: project)

        if includeLinkedItems {
            let linkedItems = linkedItemsNotInProject(for: item, project: project)
            for linkedItem in linkedItems {
                didSucceed = await addSingleItemToProject(linkedItem, project: project) && didSucceed
            }
        }

        return didSucceed
    }

    @discardableResult
    private func addSingleItemToProject(_ item: LibraryItem, project: Project) async -> Bool {
        guard !projectAssignments.contains(where: {
            $0.projectId == project.id && $0.itemId == item.id
        }) else {
            return true
        }

        let assignment = ProjectAssignment(
            projectId: project.id,
            itemId: item.id,
            itemType: item.itemType,
            createdAt: Date()
        )

        do {
            try await projectRepository.createAssignment(assignment)
            await MainActor.run {
                self.projectAssignments.append(assignment)
            }
            return true
        } catch {
            print("Error adding to project: \(error)")
            return false
        }
    }

    @discardableResult
    func addItems(_ items: [LibraryItem], to project: Project, includeLinkedItems: Bool = false) async -> Bool {
        var didSucceed = true
        let expandedItems = itemsToAddToProject(items, project: project, includeLinkedItems: includeLinkedItems)

        for item in expandedItems {
            didSucceed = await addSingleItemToProject(item, project: project) && didSucceed
        }
        return didSucceed
    }

    @discardableResult
    func removeFromProject(_ item: LibraryItem, project: Project) async -> Bool {
        do {
            try await projectRepository.deleteAssignment(
                projectId: project.id,
                itemId: item.id,
                itemType: item.itemType
            )
            await MainActor.run {
                self.projectAssignments.removeAll {
                    $0.projectId == project.id && $0.itemId == item.id
                }
            }
            return true
        } catch {
            print("Error removing from project: \(error)")
            return false
        }
    }

    @discardableResult
    func removeItems(_ items: [LibraryItem], from project: Project) async -> Bool {
        var didSucceed = true
        for item in items {
            didSucceed = await removeFromProject(item, project: project) && didSucceed
        }
        return didSucceed
    }

    func projectsContaining(_ item: LibraryItem) -> [Project] {
        let projectIds = Set(
            projectAssignments
                .filter { $0.itemId == item.id }
                .map { $0.projectId }
        )
        return projects.filter { projectIds.contains($0.id) }
    }

    func itemsInProject(_ project: Project) -> [LibraryItem] {
        orderedItemsInProject(project)
    }

    func itemCount(for project: Project) -> (total: Int, lyrics: Int, recordings: Int) {
        let assignments = projectAssignments.filter { $0.projectId == project.id }
        let lyricCount = assignments.filter { $0.itemType == .lyric }.count
        let recordingCount = assignments.filter { $0.itemType == .recording }.count
        return (assignments.count, lyricCount, recordingCount)
    }

    func assignment(for item: LibraryItem, in project: Project) -> ProjectAssignment? {
        projectAssignments.first {
            $0.projectId == project.id && $0.itemId == item.id
        }
    }

    func orderedItemsInProject(_ project: Project) -> [LibraryItem] {
        let itemsById = Dictionary(uniqueKeysWithValues: allLibraryItems.map { ($0.id, $0) })

        return projectAssignments
            .filter { $0.projectId == project.id }
            .sorted { $0.createdAt < $1.createdAt }
            .compactMap { itemsById[$0.itemId] }
    }

    func reorderItems(in project: Project, toMatch orderedItems: [LibraryItem]) async {
        let existingAssignments = projectAssignments.filter { $0.projectId == project.id }
        let assignmentsByItemId = Dictionary(uniqueKeysWithValues: existingAssignments.map { ($0.itemId, $0) })
        let calendar = Calendar(identifier: .gregorian)
        let baseDate = Date()

        for (index, item) in orderedItems.enumerated() {
            guard let assignment = assignmentsByItemId[item.id] else { continue }

            do {
                try await projectRepository.deleteAssignment(
                    projectId: project.id,
                    itemId: item.id,
                    itemType: item.itemType
                )

                let reorderedAssignment = ProjectAssignment(
                    projectId: assignment.projectId,
                    itemId: assignment.itemId,
                    itemType: assignment.itemType,
                    createdAt: calendar.date(byAdding: .second, value: index, to: baseDate) ?? baseDate
                )

                try await projectRepository.createAssignment(reorderedAssignment)
            } catch {
                print("Error reordering project item: \(error)")
            }
        }

        await loadProjectAssignments()
    }

    private func sortLibraryItems(_ items: [LibraryItem]) -> [LibraryItem] {
        items.sorted { lhs, rhs in
            switch librarySortOption {
            case .recentlyUpdated:
                return compareDates(lhs.updatedAt, rhs.updatedAt, lhs: lhs, rhs: rhs)
            case .recentlyCreated:
                return compareDates(lhs.createdAt, rhs.createdAt, lhs: lhs, rhs: rhs)
            case .title:
                let comparison = lhs.title.localizedCaseInsensitiveCompare(rhs.title)
                if comparison == .orderedSame {
                    return compareDates(lhs.updatedAt, rhs.updatedAt, lhs: lhs, rhs: rhs)
                }
                return comparison == .orderedAscending
            case .favoritesFirst:
                let lhsFavorite = isFavorite(lhs)
                let rhsFavorite = isFavorite(rhs)
                if lhsFavorite != rhsFavorite {
                    return lhsFavorite && !rhsFavorite
                }
                return compareDates(lhs.updatedAt, rhs.updatedAt, lhs: lhs, rhs: rhs)
            }
        }
    }

    private func compareDates(_ lhsDate: Date, _ rhsDate: Date, lhs: LibraryItem, rhs: LibraryItem) -> Bool {
        if lhsDate != rhsDate {
            return lhsDate > rhsDate
        }
        return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
    }

    private func uniqueDuplicateTitle(for title: String, existingTitles: [String]) -> String {
        let baseTitle = title.isEmpty ? "Untitled" : title
        let existingTitleSet = Set(existingTitles)
        let firstChoice = "\(baseTitle) Copy"
        guard existingTitleSet.contains(firstChoice) else {
            return firstChoice
        }

        var copyNumber = 2
        while existingTitleSet.contains("\(baseTitle) Copy \(copyNumber)") {
            copyNumber += 1
        }
        return "\(baseTitle) Copy \(copyNumber)"
    }

    private func uniqueLibraryItems(_ items: [LibraryItem]) -> [LibraryItem] {
        var seenKeys: Set<String> = []
        var uniqueItems: [LibraryItem] = []

        for item in items {
            let key = "\(item.itemType.rawValue):\(item.id)"
            guard !seenKeys.contains(key) else { continue }
            seenKeys.insert(key)
            uniqueItems.append(item)
        }

        return uniqueItems
    }

    private func importSharedLyric(_ item: PendingSharedImport) async throws -> LibraryItem {
        let file = try await importLyricFile(
            from: item.fileURL,
            preferredTitle: importedTitle(for: item, fallback: "Imported Note"),
            fallbackTitle: "Imported Note"
        )
        return .lyric(file)
    }

    private func importSharedRecording(_ item: PendingSharedImport) async throws -> LibraryItem {
        let recording = try await importRecordingFile(
            from: item.fileURL,
            preferredTitle: importedTitle(for: item, fallback: "Imported Recording"),
            preferredContentType: itemContentType(for: item),
            fallbackTitle: "Imported Recording"
        )
        return .recording(recording)
    }

    private func importLyricFile(
        from fileURL: URL,
        preferredTitle: String?,
        fallbackTitle: String
    ) async throws -> LyricFile {
        let didAccessSecurityScopedResource = fileURL.startAccessingSecurityScopedResource()
        defer {
            if didAccessSecurityScopedResource {
                fileURL.stopAccessingSecurityScopedResource()
            }
        }

        let body = try String(contentsOf: fileURL, encoding: .utf8)
        let file = LyricFile(
            id: UUID().uuidString,
            title: importedTitle(forFileURL: fileURL, preferredTitle: preferredTitle, fallback: fallbackTitle),
            body: body,
            createdAt: Date(),
            updatedAt: Date(),
            sectionTypes: [:]
        )

        try await lyricRepository.create(file)
        await MainActor.run {
            lyricFiles.insert(file, at: 0)
        }
        return file
    }

    private func importRecordingFile(
        from fileURL: URL,
        preferredTitle: String?,
        preferredContentType: String?,
        fallbackTitle: String
    ) async throws -> Recording {
        let didAccessSecurityScopedResource = fileURL.startAccessingSecurityScopedResource()
        defer {
            if didAccessSecurityScopedResource {
                fileURL.stopAccessingSecurityScopedResource()
            }
        }

        guard let userId = await authService.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        let recordingId = UUID().uuidString
        let storagePath = try await recordingStorageService.uploadRecording(
            from: fileURL,
            recordingId: recordingId,
            userId: userId,
            preferredFileExtension: fileURL.pathExtension,
            contentType: preferredContentType
        )

        let recording = Recording(
            id: recordingId,
            title: importedTitle(forFileURL: fileURL, preferredTitle: preferredTitle, fallback: fallbackTitle),
            createdAt: Date(),
            updatedAt: Date(),
            durationMs: await durationMilliseconds(for: fileURL),
            uri: storagePath
        )

        try await recordingRepository.create(recording)
        await MainActor.run {
            recordings.insert(recording, at: 0)
        }
        return recording
    }

    private func importedTitle(for item: PendingSharedImport, fallback: String) -> String {
        let preferredTitle = item.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let preferredTitle, !preferredTitle.isEmpty {
            return preferredTitle
        }

        let originalFilename = item.originalFilename?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let originalFilename, !originalFilename.isEmpty {
            return URL(fileURLWithPath: originalFilename)
                .deletingPathExtension()
                .lastPathComponent
        }

        let filename = item.fileURL.deletingPathExtension().lastPathComponent
        return filename.isEmpty ? fallback : filename
    }

    private func itemContentType(for item: PendingSharedImport) -> String? {
        if let typeIdentifier = item.typeIdentifier,
           let type = UTType(typeIdentifier),
           let mimeType = type.preferredMIMEType {
            return mimeType
        }

        guard
            !item.fileURL.pathExtension.isEmpty,
            let type = UTType(filenameExtension: item.fileURL.pathExtension)
        else {
            return nil
        }

        return type.preferredMIMEType
    }

    private func importedTitle(forFileURL fileURL: URL, preferredTitle: String?, fallback: String) -> String {
        let title = preferredTitle?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let title, !title.isEmpty {
            return title
        }

        let filename = fileURL.deletingPathExtension().lastPathComponent
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return filename.isEmpty ? fallback : filename
    }

    private func contentType(for fileURL: URL) -> String? {
        guard
            !fileURL.pathExtension.isEmpty,
            let type = UTType(filenameExtension: fileURL.pathExtension)
        else {
            return nil
        }

        return type.preferredMIMEType
    }

    private func durationMilliseconds(for fileURL: URL) async -> Int {
        let asset = AVURLAsset(url: fileURL)
        let duration: CMTime
        do {
            duration = try await asset.load(.duration)
        } catch {
            return 0
        }

        let seconds = CMTimeGetSeconds(duration)
        guard seconds.isFinite, !seconds.isNaN else {
            return 0
        }

        return max(Int(seconds * 1000), 0)
    }

    private func mutateMetadata(for items: [LibraryItem], update: (inout LibraryItemMetadata) -> Void) {
        var changedMetadata = itemMetadataById
        for item in items {
            var metadata = changedMetadata[item.id] ?? LibraryItemMetadata()
            update(&metadata)
            changedMetadata[item.id] = metadata
        }
        itemMetadataById = changedMetadata
        persistLibraryMetadata()
    }

    private func removeMetadata(forItemId itemId: String) {
        itemMetadataById.removeValue(forKey: itemId)
        persistLibraryMetadata()
    }

    private func loadLibraryMetadata() {
        guard let data = UserDefaults.standard.data(forKey: Self.libraryMetadataDefaultsKey) else {
            itemMetadataById = [:]
            return
        }

        do {
            itemMetadataById = try JSONDecoder().decode([String: LibraryItemMetadata].self, from: data)
        } catch {
            itemMetadataById = [:]
            print("Error loading library metadata: \(error)")
        }
    }

    private func persistLibraryMetadata() {
        do {
            let data = try JSONEncoder().encode(itemMetadataById)
            UserDefaults.standard.set(data, forKey: Self.libraryMetadataDefaultsKey)
        } catch {
            print("Error saving library metadata: \(error)")
        }
    }
}
