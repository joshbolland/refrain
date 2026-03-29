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

@Observable
final class AppState {
    private static let libraryMetadataDefaultsKey = "refrain.library.item.metadata"

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
    var librarySortOption: LibrarySortOption = .recentlyUpdated
    var archiveFilter: LibraryArchiveFilter = .activeOnly

    // MARK: - Local Library Metadata
    var itemMetadataById: [String: LibraryItemMetadata] = [:]

    // MARK: - UI State
    var isTabBarHidden = false

    // MARK: - Services
    private let authService = AuthService.shared
    private let lyricRepository = LyricRepository()
    private let recordingRepository = RecordingRepository()
    private let collectionRepository = CollectionRepository()
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
                self.collectionAssignments.removeAll { $0.itemId == file.id }
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
                self.collectionAssignments.removeAll { $0.itemId == recording.id }
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
        guard !collectionAssignments.contains(where: {
            $0.collectionId == collection.id && $0.itemId == item.id
        }) else {
            return
        }

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

    func addItems(_ items: [LibraryItem], to collection: Collection) async {
        for item in items {
            await addToCollection(item, collection: collection)
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

    func removeItems(_ items: [LibraryItem], from collection: Collection) async {
        for item in items {
            await removeFromCollection(item, collection: collection)
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
        orderedItemsInCollection(collection)
    }

    func itemCount(for collection: Collection) -> (total: Int, lyrics: Int, recordings: Int) {
        let assignments = collectionAssignments.filter { $0.collectionId == collection.id }
        let lyricCount = assignments.filter { $0.itemType == .lyric }.count
        let recordingCount = assignments.filter { $0.itemType == .recording }.count
        return (assignments.count, lyricCount, recordingCount)
    }

    func assignment(for item: LibraryItem, in collection: Collection) -> CollectionAssignment? {
        collectionAssignments.first {
            $0.collectionId == collection.id && $0.itemId == item.id
        }
    }

    func orderedItemsInCollection(_ collection: Collection) -> [LibraryItem] {
        let itemsById = Dictionary(uniqueKeysWithValues: allLibraryItems.map { ($0.id, $0) })

        return collectionAssignments
            .filter { $0.collectionId == collection.id }
            .sorted { $0.createdAt < $1.createdAt }
            .compactMap { itemsById[$0.itemId] }
    }

    func reorderItems(in collection: Collection, toMatch orderedItems: [LibraryItem]) async {
        let existingAssignments = collectionAssignments.filter { $0.collectionId == collection.id }
        let assignmentsByItemId = Dictionary(uniqueKeysWithValues: existingAssignments.map { ($0.itemId, $0) })
        let calendar = Calendar(identifier: .gregorian)
        let baseDate = Date()

        for (index, item) in orderedItems.enumerated() {
            guard let assignment = assignmentsByItemId[item.id] else { continue }

            do {
                try await collectionRepository.deleteAssignment(
                    collectionId: collection.id,
                    itemId: item.id
                )

                let reorderedAssignment = CollectionAssignment(
                    collectionId: assignment.collectionId,
                    itemId: assignment.itemId,
                    itemType: assignment.itemType,
                    createdAt: calendar.date(byAdding: .second, value: index, to: baseDate) ?? baseDate
                )

                try await collectionRepository.createAssignment(reorderedAssignment)
            } catch {
                print("Error reordering collection item: \(error)")
            }
        }

        await loadCollectionAssignments()
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
