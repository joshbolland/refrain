import SwiftUI
import Supabase

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

@Observable
final class AppState {
    // MARK: - User State
    var currentUser: User?
    var isLoading = true

    // MARK: - Library State
    var lyricFiles: [LyricFile] = []
    var recordings: [Recording] = []
    var collections: [Collection] = []
    var collectionAssignments: [CollectionAssignment] = []

    // MARK: - Filter State
    var searchQuery = ""
    var selectedCollectionFilter: Collection.ID?
    var selectedItemTypeFilter: LibraryItemTypeFilter = .all

    // MARK: - UI State
    var isTabBarHidden = false

    // MARK: - Services
    private let authService = AuthService.shared
    private let lyricRepository = LyricRepository()
    private let recordingRepository = RecordingRepository()
    private let collectionRepository = CollectionRepository()
    private let recordingStorageService = RecordingStorageService.shared

    // MARK: - Initialization

    init() {}

    func initialize() async {
        isLoading = true
        defer { isLoading = false }

        // Check for existing session
        if let user = await authService.getCurrentUser() {
            currentUser = user
            await loadAllData()
        }

        // Listen for auth state changes
        Task {
            for await state in authService.authStateChanges {
                await MainActor.run {
                    self.currentUser = state.user
                }
                if state.user != nil {
                    await loadAllData()
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
        guard url.scheme == Config.oauthCallbackScheme, url.host == "auth" else {
            return
        }

        do {
            let user = try await authService.handleOAuthCallback(url: url)
            await MainActor.run {
                self.currentUser = user
            }
        } catch {
            print("Error handling OAuth callback: \(error)")
        }
    }

    // MARK: - Data Loading

    func loadAllData() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.loadLyricFiles() }
            group.addTask { await self.loadRecordings() }
            group.addTask { await self.loadCollections() }
            group.addTask { await self.loadCollectionAssignments() }
        }
    }

    @MainActor
    private func clearData() {
        lyricFiles = []
        recordings = []
        collections = []
        collectionAssignments = []
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

    func loadCollections() async {
        do {
            let items = try await collectionRepository.fetchAll()
            await MainActor.run {
                self.collections = items
            }
        } catch {
            print("Error loading collections: \(error)")
        }
    }

    func loadCollectionAssignments() async {
        do {
            let items = try await collectionRepository.fetchAllAssignments()
            await MainActor.run {
                self.collectionAssignments = items
            }
        } catch {
            print("Error loading collection assignments: \(error)")
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

        // Apply collection filter
        if let collectionId = selectedCollectionFilter {
            let itemIdsInCollection = Set(
                collectionAssignments
                    .filter { $0.collectionId == collectionId }
                    .map { $0.itemId }
            )
            items = items.filter { itemIdsInCollection.contains($0.id) }
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

        // Sort by most recently updated
        return items.sorted { $0.updatedAt > $1.updatedAt }
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

    func deleteLyricFile(_ file: LyricFile) async {
        do {
            try await lyricRepository.delete(file.id)
            await MainActor.run {
                self.lyricFiles.removeAll { $0.id == file.id }
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
            }
        } catch {
            print("Error deleting recording: \(error)")
        }
    }

    // MARK: - Collection Operations

    func createCollection(title: String, description: String? = nil) async -> Collection? {
        let collection = Collection(
            id: UUID().uuidString,
            title: title,
            description: description,
            createdAt: Date(),
            updatedAt: Date()
        )

        do {
            try await collectionRepository.create(collection)
            await MainActor.run {
                self.collections.insert(collection, at: 0)
            }
            return collection
        } catch {
            print("Error creating collection: \(error)")
            return nil
        }
    }

    func updateCollection(_ collection: Collection) async {
        var updated = collection
        updated.updatedAt = Date()
        let finalUpdated = updated

        do {
            try await collectionRepository.update(finalUpdated)
            await MainActor.run {
                if let index = self.collections.firstIndex(where: { $0.id == collection.id }) {
                    self.collections[index] = finalUpdated
                }
            }
        } catch {
            print("Error updating collection: \(error)")
        }
    }

    func deleteCollection(_ collection: Collection) async {
        do {
            try await collectionRepository.delete(collection.id)
            await MainActor.run {
                self.collections.removeAll { $0.id == collection.id }
                self.collectionAssignments.removeAll { $0.collectionId == collection.id }
            }
        } catch {
            print("Error deleting collection: \(error)")
        }
    }

    // MARK: - Collection Assignment Operations

    func addToCollection(_ item: LibraryItem, collection: Collection) async {
        let assignment = CollectionAssignment(
            collectionId: collection.id,
            itemId: item.id,
            itemType: item.itemType,
            createdAt: Date()
        )

        do {
            try await collectionRepository.createAssignment(assignment)
            await MainActor.run {
                self.collectionAssignments.append(assignment)
            }
        } catch {
            print("Error adding to collection: \(error)")
        }
    }

    func removeFromCollection(_ item: LibraryItem, collection: Collection) async {
        do {
            try await collectionRepository.deleteAssignment(
                collectionId: collection.id,
                itemId: item.id
            )
            await MainActor.run {
                self.collectionAssignments.removeAll {
                    $0.collectionId == collection.id && $0.itemId == item.id
                }
            }
        } catch {
            print("Error removing from collection: \(error)")
        }
    }

    func collectionsContaining(_ item: LibraryItem) -> [Collection] {
        let collectionIds = Set(
            collectionAssignments
                .filter { $0.itemId == item.id }
                .map { $0.collectionId }
        )
        return collections.filter { collectionIds.contains($0.id) }
    }

    func itemsInCollection(_ collection: Collection) -> [LibraryItem] {
        let itemIds = Set(
            collectionAssignments
                .filter { $0.collectionId == collection.id }
                .map { $0.itemId }
        )

        var items: [LibraryItem] = []
        for file in lyricFiles where itemIds.contains(file.id) {
            items.append(.lyric(file))
        }
        for recording in recordings where itemIds.contains(recording.id) {
            items.append(.recording(recording))
        }

        return items.sorted { $0.updatedAt > $1.updatedAt }
    }

    func itemCount(for collection: Collection) -> (total: Int, lyrics: Int, recordings: Int) {
        let assignments = collectionAssignments.filter { $0.collectionId == collection.id }
        let lyricCount = assignments.filter { $0.itemType == .lyric }.count
        let recordingCount = assignments.filter { $0.itemType == .recording }.count
        return (assignments.count, lyricCount, recordingCount)
    }
}
