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

    // MARK: - Filter State
    var searchQuery = ""
    var selectedProjectFilter: Project.ID?
    var selectedItemTypeFilter: LibraryItemTypeFilter = .all
    var librarySortOption: LibrarySortOption = .recentlyUpdated
    var archiveFilter: LibraryArchiveFilter = .activeOnly

    // MARK: - Local Library Metadata
    var itemMetadataById: [String: LibraryItemMetadata] = [:]

    // MARK: - UI State
    var isTabBarHidden = false
    var selectedTab: MainTab = .library
    var pendingLibrarySelection: LibraryItem?
    var sharedImportFeedback: SharedImportFeedback?

    // MARK: - Services
    private let authService = AuthService.shared
    private let lyricRepository = LyricRepository()
    private let recordingRepository = RecordingRepository()
    private let projectRepository = ProjectRepository()
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
        }
    }

    @MainActor
    private func clearData() {
        lyricFiles = []
        recordings = []
        projects = []
        projectAssignments = []
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

    // MARK: - Lyric File Operations

    func createLyricFile(title: String = "Untitled") async -> LyricFile? {
        let file = LyricFile(
            id: UUID().uuidString,
            title: title,
            body: "",
            createdAt: Date(),
            updatedAt: Date(),
            sectionTypes: [:]
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
            try await lyricRepository.delete(file.id)
            await MainActor.run {
                self.lyricFiles.removeAll { $0.id == file.id }
                self.projectAssignments.removeAll { $0.itemId == file.id }
                self.removeMetadata(forItemId: file.id)
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
                self.recordings.removeAll { $0.id == recording.id }
                self.projectAssignments.removeAll { $0.itemId == recording.id }
                self.removeMetadata(forItemId: recording.id)
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
    func addToProject(_ item: LibraryItem, project: Project) async -> Bool {
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
    func addItems(_ items: [LibraryItem], to project: Project) async -> Bool {
        var didSucceed = true
        for item in items {
            didSucceed = await addToProject(item, project: project) && didSucceed
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

    private func importSharedLyric(_ item: PendingSharedImport) async throws -> LibraryItem {
        let body = try String(contentsOf: item.fileURL, encoding: .utf8)
        let title = importedTitle(for: item, fallback: "Imported Note")

        let file = LyricFile(
            id: UUID().uuidString,
            title: title,
            body: body,
            createdAt: Date(),
            updatedAt: Date(),
            sectionTypes: [:]
        )

        try await lyricRepository.create(file)
        await MainActor.run {
            lyricFiles.insert(file, at: 0)
        }
        return .lyric(file)
    }

    private func importSharedRecording(_ item: PendingSharedImport) async throws -> LibraryItem {
        guard let userId = await authService.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        let recordingId = UUID().uuidString
        let storagePath = try await recordingStorageService.uploadRecording(
            from: item.fileURL,
            recordingId: recordingId,
            userId: userId,
            preferredFileExtension: item.fileURL.pathExtension,
            contentType: itemContentType(for: item)
        )

        let recording = Recording(
            id: recordingId,
            title: importedTitle(for: item, fallback: "Imported Recording"),
            createdAt: Date(),
            updatedAt: Date(),
            durationMs: await durationMilliseconds(for: item.fileURL),
            uri: storagePath
        )

        try await recordingRepository.create(recording)
        await MainActor.run {
            recordings.insert(recording, at: 0)
        }
        return .recording(recording)
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
