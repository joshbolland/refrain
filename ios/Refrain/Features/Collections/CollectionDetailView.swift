import SwiftUI
import UIKit

struct CollectionDetailView: View {
    private enum ItemSortOption: String, CaseIterable, Identifiable {
        case recentlyUpdated
        case oldestUpdated
        case title
        case manual

        var id: String { rawValue }

        var label: String {
            switch self {
            case .manual:
                return "Manual"
            case .recentlyUpdated:
                return "Newest"
            case .oldestUpdated:
                return "Oldest"
            case .title:
                return "A-Z"
            }
        }
    }

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let collection: Collection

    @State private var isEditingTitle = false
    @State private var editedTitle: String
    @State private var selectedItem: LibraryItem?
    @State private var showManageItemsSheet = false
    @State private var showReorderSheet = false
    @State private var sortOption: ItemSortOption = .recentlyUpdated

    init(collection: Collection) {
        self.collection = collection
        self._editedTitle = State(initialValue: collection.title)
    }

    private var currentCollection: Collection {
        appState.collections.first(where: { $0.id == collection.id }) ?? collection
    }

    private var manualItems: [LibraryItem] {
        appState.orderedItemsInCollection(currentCollection)
    }

    private var items: [LibraryItem] {
        switch sortOption {
        case .manual:
            return manualItems
        case .recentlyUpdated:
            return manualItems.sorted { $0.updatedAt > $1.updatedAt }
        case .oldestUpdated:
            return manualItems.sorted { $0.updatedAt < $1.updatedAt }
        case .title:
            return manualItems.sorted {
                $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
            }
        }
    }

    private var subtitle: String {
        let count = items.count
        return "\(count) \(count == 1 ? "item" : "items")"
    }

    private var collectionDescription: String? {
        let description = currentCollection.description?.trimmingCharacters(in: .whitespacesAndNewlines)
        return description?.isEmpty == false ? description : nil
    }

    private var rowMetadataByItemID: [String: LibraryItemMetadata] {
        Dictionary(uniqueKeysWithValues: items.map { ($0.id, appState.metadata(for: $0)) })
    }

    private var collectionCountByItemID: [String: Int] {
        Dictionary(uniqueKeysWithValues: items.map { ($0.id, appState.collectionsContaining($0).count) })
    }

    var body: some View {
        ZStack(alignment: .top) {
            Theme.headerBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                headerView()

                ScrollView {
                    VStack(spacing: 16) {
                        controlsView

                        if items.isEmpty {
                            emptyStateView
                        } else {
                            LazyVStack(spacing: 0) {
                                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                                    let metadata = rowMetadataByItemID[item.id] ?? LibraryItemMetadata()
                                    let collectionCount = collectionCountByItemID[item.id] ?? 0

                                    LibraryItemRow(
                                        item: item,
                                        metadata: metadata,
                                        collectionCount: collectionCount,
                                        isSelectionMode: false,
                                        isSelected: false,
                                        onSelect: {
                                            selectedItem = item
                                        },
                                        showsPressFeedback: false
                                    )
                                    .contextMenu {
                                        rowContextMenu(for: item)
                                    }

                                    if index < items.count - 1 {
                                        Divider()
                                            .background(Theme.divider)
                                    }
                                }
                            }
                        }
                    }
                    .padding(.top, 20)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 120)
                    .frame(maxWidth: .infinity)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.paper)
                .clipShape(
                    RoundedCorner(
                        radius: Theme.cornerRadiusSmall,
                        corners: [.topLeft, .topRight]
                    )
                )
                .shadow(color: Color.black.opacity(0.06), radius: 12, x: 0, y: 6)
                .ignoresSafeArea(edges: .bottom)
            }
        }
        .background(InteractivePopGestureEnabler())
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(item: $selectedItem) { item in
            switch item {
            case .lyric(let file):
                LyricEditorView(file: file)
            case .recording(let recording):
                PlaybackView(recording: recording)
            }
        }
        .onAppear {
            appState.isTabBarHidden = true
        }
        .onDisappear {
            appState.isTabBarHidden = false
        }
        .sheet(isPresented: $showManageItemsSheet) {
            CollectionItemSelectionSheet(collection: currentCollection)
        }
        .sheet(isPresented: $showReorderSheet) {
            CollectionReorderSheet(collection: currentCollection)
        }
        .alert("Rename Collection", isPresented: $isEditingTitle) {
            TextField("Title", text: $editedTitle)
            Button("Cancel", role: .cancel) {
                editedTitle = currentCollection.title
            }
            Button("Save") {
                saveTitle()
            }
        }
    }

    @ViewBuilder
    private func rowContextMenu(for item: LibraryItem) -> some View {
        Button {
            showManageItemsSheet = true
        } label: {
            Label("Manage Collection Items", systemImage: "checklist")
        }

        Button(role: .destructive) {
            removeItemFromCurrentCollection(item)
        } label: {
            Label("Remove", systemImage: "folder.badge.minus")
        }
    }

    private func headerView() -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .frame(width: 36, height: 36)
                        .background(Theme.paper)
                        .clipShape(Circle())
                }
                .buttonStyle(PressableScaleStyle())

                Spacer()

                Menu {
                    Button {
                        showManageItemsSheet = true
                    } label: {
                        Label("Bulk Add or Remove", systemImage: "checklist")
                    }

                    Button {
                        showReorderSheet = true
                    } label: {
                        Label("Reorder Items", systemImage: "arrow.up.arrow.down")
                    }

                    Button {
                        isEditingTitle = true
                    } label: {
                        Label("Rename", systemImage: "pencil")
                    }

                    Divider()

                    Button(role: .destructive) {
                        Task {
                            await appState.deleteCollection(currentCollection)
                            dismiss()
                        }
                    } label: {
                        Label("Delete Collection", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .frame(width: 36, height: 36)
                        .background(Theme.paper)
                        .clipShape(Circle())
                }
            }

            Text(currentCollection.title)
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(Theme.ink)

            if let description = collectionDescription {
                Text(description)
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.muted.opacity(0.88))
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text(subtitle)
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted.opacity(0.8))
        }
        .padding(.top, 6)
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private func removeItemFromCurrentCollection(_ item: LibraryItem) {
        let collection = currentCollection
        Task {
            await appState.removeFromCollection(item, collection: collection)
        }
    }

    private var controlsView: some View {
        HStack(spacing: 10) {
            Button {
                showManageItemsSheet = true
            } label: {
                Label("Manage Items", systemImage: "checklist")
                    .frame(maxWidth: .infinity)
            }
            .secondaryButtonStyle()
            .buttonStyle(PressableScaleStyle())

            Menu {
                Picker("Sort Items", selection: $sortOption) {
                    ForEach(ItemSortOption.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }

                Button {
                    showReorderSheet = true
                } label: {
                    Label("Manual Reorder", systemImage: "arrow.up.arrow.down")
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.up.arrow.down.circle")
                        .font(.system(size: 15, weight: .semibold))

                    Text(sortOption.label)
                        .lineLimit(1)

                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.muted.opacity(0.8))
                }
                .frame(minWidth: 110)
            }
            .secondaryButtonStyle()
            .transaction { transaction in
                transaction.animation = nil
            }
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: 10) {
            Text("This collection is empty")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.ink)

            Text("Add lyrics or recordings from your library.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted.opacity(0.9))

            Button {
                showManageItemsSheet = true
            } label: {
                Text("Add Items")
                    .frame(maxWidth: .infinity)
            }
            .primaryButtonStyle()
            .buttonStyle(PressableScaleStyle())
            .padding(.top, 6)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .padding(.horizontal, 18)
        .background(Theme.accentSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    private func saveTitle() {
        let trimmedTitle = editedTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmedTitle != currentCollection.title, !trimmedTitle.isEmpty else { return }

        var updated = currentCollection
        updated.title = trimmedTitle
        Task {
            await appState.updateCollection(updated)
        }
    }
}

private struct CollectionItemSelectionSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let collection: Collection

    @State private var selectedItemIds: Set<String>
    @State private var isSaving = false

    init(collection: Collection) {
        self.collection = collection
        self._selectedItemIds = State(initialValue: [])
    }

    private var currentCollection: Collection {
        appState.collections.first(where: { $0.id == collection.id }) ?? collection
    }

    private var libraryItems: [LibraryItem] {
        appState.allLibraryItems
    }

    private var currentMembership: Set<String> {
        Set(appState.itemsInCollection(currentCollection).map(\.id))
    }

    private var selectedCountLabel: String {
        let count = selectedItemIds.count
        return "\(count) \(count == 1 ? "item selected" : "items selected")"
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Manage Items")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(Theme.ink)

                        Text(selectedCountLabel)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.muted.opacity(0.82))
                    }

                    Spacer()

                    Button("Close") {
                        dismiss()
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .textCase(.uppercase)
                    .tracking(1.2)
                    .foregroundStyle(Theme.muted)
                }

                HStack(spacing: 10) {
                    Button("Select All") {
                        selectedItemIds = Set(libraryItems.map(\.id))
                    }
                    .secondaryButtonStyle()
                    .buttonStyle(PressableScaleStyle())

                    Button("Clear All") {
                        selectedItemIds.removeAll()
                    }
                    .secondaryButtonStyle()
                    .buttonStyle(PressableScaleStyle())
                }

                if libraryItems.isEmpty {
                    VStack(spacing: 8) {
                        Text("No library items yet")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Theme.ink)

                        Text("Create a lyric or recording first, then add it here.")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.muted.opacity(0.82))
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(libraryItems, id: \.id) { item in
                                CollectionItemSelectionRow(
                                    item: item,
                                    isSelected: selectedItemIds.contains(item.id)
                                ) {
                                    toggle(item)
                                }
                            }
                        }
                    }
                }

                Button {
                    Task {
                        await saveChanges()
                    }
                } label: {
                    Text(isSaving ? "Saving..." : "Save Changes")
                        .frame(maxWidth: .infinity)
                }
                .primaryButtonStyle()
                .buttonStyle(PressableScaleStyle())
                .disabled(isSaving)
                .opacity(isSaving ? 0.6 : 1)
            }
            .padding(24)
            .background(Theme.paper)
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .onAppear {
                selectedItemIds = currentMembership
            }
        }
    }

    private func toggle(_ item: LibraryItem) {
        if selectedItemIds.contains(item.id) {
            selectedItemIds.remove(item.id)
        } else {
            selectedItemIds.insert(item.id)
        }
    }

    private func saveChanges() async {
        isSaving = true

        let currentIds = currentMembership
        let itemsById = Dictionary(uniqueKeysWithValues: libraryItems.map { ($0.id, $0) })

        let itemsToAdd = selectedItemIds
            .subtracting(currentIds)
            .compactMap { itemsById[$0] }
        let itemsToRemove = currentIds
            .subtracting(selectedItemIds)
            .compactMap { itemsById[$0] }

        await appState.addItems(itemsToAdd, to: currentCollection)
        await appState.removeItems(itemsToRemove, from: currentCollection)

        await MainActor.run {
            dismiss()
        }
    }
}

private struct CollectionItemSelectionRow: View {
    let item: LibraryItem
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(item.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)

                    Text(detailLabel)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.muted.opacity(0.82))
                        .lineLimit(2)
                }

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? Theme.accent : Theme.muted.opacity(0.5))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .cardStyle()
        }
        .buttonStyle(PressableScaleStyle())
    }

    private var detailLabel: String {
        switch item {
        case .lyric(let file):
            let body = file.body.trimmingCharacters(in: .whitespacesAndNewlines)
            return body.isEmpty ? "Lyric draft" : body
        case .recording(let recording):
            return "\(recording.formattedDuration) recording"
        }
    }
}

private struct CollectionReorderSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let collection: Collection

    @State private var orderedItems: [LibraryItem] = []
    @State private var isSaving = false

    private var currentCollection: Collection {
        appState.collections.first(where: { $0.id == collection.id }) ?? collection
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(orderedItems, id: \.id) { item in
                    HStack(spacing: 12) {
                        Image(systemName: item.isLyric ? "music.note" : "waveform")
                            .foregroundStyle(Theme.accentPressed)
                            .frame(width: 20)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.title)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Theme.ink)

                            Text(item.isLyric ? "Lyric" : "Recording")
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.muted.opacity(0.8))
                        }
                    }
                    .listRowBackground(Theme.paper)
                }
                .onMove(perform: moveItems)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.paper)
            .navigationTitle("Reorder Items")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    EditButton()
                }

                ToolbarItem(placement: .bottomBar) {
                    Button {
                        Task {
                            await saveOrder()
                        }
                    } label: {
                        Text(isSaving ? "Saving..." : "Save Order")
                            .frame(maxWidth: .infinity)
                    }
                    .primaryButtonStyle()
                    .buttonStyle(PressableScaleStyle())
                    .disabled(isSaving || orderedItems.isEmpty)
                    .opacity(isSaving || orderedItems.isEmpty ? 0.6 : 1)
                }
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .onAppear {
                orderedItems = appState.orderedItemsInCollection(currentCollection)
            }
        }
    }

    private func moveItems(from source: IndexSet, to destination: Int) {
        orderedItems.move(fromOffsets: source, toOffset: destination)
    }

    private func saveOrder() async {
        isSaving = true
        await appState.reorderItems(in: currentCollection, toMatch: orderedItems)
        await MainActor.run {
            dismiss()
        }
    }
}

private struct InteractivePopGestureEnabler: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        UIViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        DispatchQueue.main.async {
            guard let navigationController = uiViewController.navigationController else { return }
            navigationController.interactivePopGestureRecognizer?.isEnabled = true
            navigationController.interactivePopGestureRecognizer?.delegate = nil
        }
    }
}

#Preview("Collection Detail Populated") {
    NavigationStack {
        CollectionDetailView(collection: AppState.previewCollection())
    }
    .environment(AppState.preview())
    .environment(\.isPreview, true)
}

#Preview("Collection Detail Empty") {
    let state = AppState.preview()
    let emptyCollection = Collection(
        id: "collection-empty",
        title: "Voice Notes",
        description: "A fresh collection with no items yet"
    )
    state.collections.insert(emptyCollection, at: 0)

    return NavigationStack {
        CollectionDetailView(collection: emptyCollection)
    }
    .environment(state)
    .environment(\.isPreview, true)
}
