import SwiftUI

struct LibraryView: View {
    @Environment(AppState.self) private var appState

    @State private var showFilterSheet = false
    @State private var showProfile = false
    @State private var selectedItem: LibraryItem?
    @State private var collectionSheetItem: LibraryItem?
    @State private var showManageItemsSheet = false
    @State private var swipeOpenItemId: String?
    @State private var renamingItem: LibraryItem?
    @State private var renameDraft = ""

    private var visibleItems: [LibraryItem] {
        appState.filteredLibraryItems
    }

    private var headerSubtitle: String {
        if !appState.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Showing results for \"\(appState.searchQuery)\""
        }

        let count = visibleItems.count
        return "\(count) \(count == 1 ? "idea" : "ideas")"
    }

    private var hasActiveFilters: Bool {
        appState.selectedCollectionFilter != nil ||
        appState.selectedItemTypeFilter != .all ||
        appState.archiveFilter != .activeOnly
    }

    private var renameAlertIsPresented: Binding<Bool> {
        Binding(
            get: { renamingItem != nil },
            set: { isPresented in
                if !isPresented {
                    renamingItem = nil
                }
            }
        )
    }

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                ZStack(alignment: .top) {
                    Theme.headerBackground
                        .ignoresSafeArea()

                    VStack(spacing: 0) {
                        headerView(topInset: proxy.safeAreaInsets.top)

                        ScrollView {
                            VStack(spacing: 16) {
                                SearchBar(text: Binding(
                                    get: { appState.searchQuery },
                                    set: { appState.searchQuery = $0 }
                                ), placeholder: "Search ideas")

                                controlsView

                                if hasActiveFilters {
                                    managementSummary
                                }

                                if visibleItems.isEmpty {
                                    emptyStateView
                                } else {
                                    listView
                                }
                            }
                            .padding(.top, 22)
                            .padding(.horizontal, 20)
                            .padding(.bottom, 120)
                            .frame(maxWidth: .infinity)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Theme.paper)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            closeOpenSwipeRow()
                        }
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
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showFilterSheet) {
                LibraryFilterSheet()
            }
            .sheet(isPresented: $showProfile) {
                ProfileView()
            }
            .sheet(isPresented: $showManageItemsSheet) {
                LibraryItemManagementSheet()
            }
            .sheet(item: $collectionSheetItem) { item in
                CollectionsSheet(item: item)
            }
            .navigationDestination(item: $selectedItem) { item in
                switch item {
                case .lyric(let file):
                    LyricEditorView(file: file)
                case .recording(let recording):
                    PlaybackView(recording: recording)
                }
            }
            .alert("Rename Item", isPresented: renameAlertIsPresented) {
                TextField("Title", text: $renameDraft)

                Button("Cancel", role: .cancel) {
                    renamingItem = nil
                }

                Button("Save") {
                    guard let item = renamingItem else { return }
                    let newTitle = renameDraft
                    renamingItem = nil
                    Task {
                        await appState.renameItem(item, to: newTitle)
                    }
                }
            }
            .onChange(of: appState.searchQuery) {
                swipeOpenItemId = nil
            }
        }
    }

    private func headerView(topInset: CGFloat) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Library")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(Theme.ink)

                Text(headerSubtitle)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted.opacity(0.8))
            }

            Spacer()

            HStack(spacing: 10) {
                Menu {
                    Button {
                        showManageItemsSheet = true
                    } label: {
                        Label("Manage Items", systemImage: "checklist")
                    }

                    Button {
                        showFilterSheet = true
                    } label: {
                        Label("Filters", systemImage: "line.3.horizontal.decrease.circle")
                    }
                } label: {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Theme.ink)
                            .frame(width: 36, height: 36)
                            .background(Theme.paper.opacity(0.92))
                            .clipShape(Circle())

                        if hasActiveFilters {
                            Circle()
                                .fill(Theme.accent)
                                .frame(width: 8, height: 8)
                                .offset(x: 2, y: -2)
                        }
                    }
                }
                .buttonStyle(PressableScaleStyle())

                Button {
                    showProfile = true
                } label: {
                    UserAvatar(user: appState.currentUser)
                }
                .buttonStyle(PressableScaleStyle())
            }
        }
        .padding(.top, 6)
        .padding(.horizontal, 20)
        .padding(.bottom, 28)
    }

    private var controlsView: some View {
        HStack {
            Spacer()

            Menu {
                Picker("Sort Items", selection: Binding(
                    get: { appState.librarySortOption },
                    set: { appState.librarySortOption = $0 }
                )) {
                    ForEach(LibrarySortOption.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.up.arrow.down.circle")
                        .font(.system(size: 15, weight: .semibold))

                    Text(appState.librarySortOption.label)
                        .lineLimit(1)

                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.muted.opacity(0.8))
                }
            }
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(Theme.ink)
            .transaction { transaction in
                transaction.animation = nil
            }
        }
    }

    private var managementSummary: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if appState.archiveFilter != .activeOnly {
                    summaryChip(label: "Show: \(appState.archiveFilter.label)")
                }

                if appState.selectedItemTypeFilter != .all {
                    summaryChip(label: appState.selectedItemTypeFilter.label)
                }

                if let collectionID = appState.selectedCollectionFilter,
                   let collection = appState.collections.first(where: { $0.id == collectionID }) {
                    summaryChip(label: collection.title)
                }
            }
        }
    }

    private func summaryChip(label: String) -> some View {
        Text(label)
            .font(.system(size: 11, weight: .semibold))
            .textCase(.uppercase)
            .tracking(0.8)
            .foregroundStyle(Theme.accentPressed)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color(hex: "E8EBFF"))
            .clipShape(Capsule())
    }

    private var emptyStateView: some View {
        VStack(spacing: 10) {
            Text(appState.archiveFilter == .archivedOnly ? "No archived ideas yet." : "This is your first idea.")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.ink)

            Text(
                appState.archiveFilter == .archivedOnly
                ? "Archived songs and memos will appear here."
                : "Every song starts somewhere."
            )
            .font(.system(size: 14))
            .foregroundStyle(Theme.muted.opacity(0.9))

            if appState.archiveFilter != .archivedOnly {
                Button {
                    Task {
                        if let file = await appState.createLyricFile() {
                            selectedItem = .lyric(file)
                        }
                    }
                } label: {
                    Text("Create lyric")
                        .font(.system(size: 11, weight: .semibold))
                        .textCase(.uppercase)
                        .tracking(2)
                        .foregroundStyle(Theme.accentPressed)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 6)
                        .background(Color(hex: "E8EBFF"))
                        .overlay(
                            Capsule()
                                .stroke(Color(hex: "C7D1FF"), lineWidth: 1)
                        )
                        .clipShape(Capsule())
                }
                .buttonStyle(PressableScaleStyle())
                .padding(.top, 6)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .padding(.horizontal, 18)
        .background(Theme.accentSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    private var listView: some View {
        LazyVStack(spacing: 0) {
            ForEach(Array(visibleItems.enumerated()), id: \.element.id) { index, item in
                SwipeToDeleteRow(
                    id: item.id,
                    isOpen: swipeOpenItemId == item.id,
                    isEnabled: true,
                    onOpenChange: { isOpen in
                        swipeOpenItemId = isOpen ? item.id : (swipeOpenItemId == item.id ? nil : swipeOpenItemId)
                    },
                    onDelete: {
                        swipeOpenItemId = nil
                        Task { await deleteItem(item) }
                    }
                ) {
                    LibraryItemRow(
                        item: item,
                        metadata: appState.metadata(for: item),
                        collectionCount: appState.collectionsContaining(item).count,
                        isSelectionMode: false,
                        isSelected: false,
                        onSelect: {
                            if swipeOpenItemId == item.id {
                                withAnimation(.spring(response: 0.24, dampingFraction: 0.9)) {
                                    swipeOpenItemId = nil
                                }
                                return
                            }
                            selectedItem = item
                        },
                        showsPressFeedback: true
                    )
                }
                .contextMenu {
                    contextMenuContent(for: item)
                }

                if index < visibleItems.count - 1 {
                    Divider()
                        .background(Theme.divider)
                }
            }
        }
    }

    @ViewBuilder
    private func contextMenuContent(for item: LibraryItem) -> some View {
        Button {
            selectedItem = item
        } label: {
            Label("Open", systemImage: "arrow.right.circle")
        }

        Button {
            beginRenaming(item)
        } label: {
            Label("Rename", systemImage: "pencil")
        }

        Button {
            Task {
                _ = await appState.duplicateItem(item)
            }
        } label: {
            Label("Duplicate", systemImage: "plus.square.on.square")
        }

        Button {
            appState.setFavorite(!appState.isFavorite(item), for: item)
        } label: {
            Label(
                appState.isFavorite(item) ? "Remove Favorite" : "Favorite",
                systemImage: appState.isFavorite(item) ? "star.slash" : "star"
            )
        }

        Button {
            appState.setArchived(!appState.isArchived(item), for: item)
        } label: {
            Label(
                appState.isArchived(item) ? "Restore" : "Archive",
                systemImage: appState.isArchived(item) ? "tray.and.arrow.up" : "archivebox"
            )
        }

        Button {
            collectionSheetItem = item
        } label: {
            Label("Add to Collection", systemImage: "folder.badge.plus")
        }

        Divider()

        Button(role: .destructive) {
            Task { await deleteItem(item) }
        } label: {
            Label("Delete", systemImage: "trash")
        }
    }

    private func beginRenaming(_ item: LibraryItem) {
        renamingItem = item
        renameDraft = item.title
    }

    private func deleteItem(_ item: LibraryItem) async {
        switch item {
        case .lyric(let file):
            await appState.deleteLyricFile(file)
        case .recording(let recording):
            await appState.deleteRecording(recording)
        }
    }

    private func closeOpenSwipeRow() {
        guard swipeOpenItemId != nil else { return }
        withAnimation(.spring(response: 0.24, dampingFraction: 0.9)) {
            swipeOpenItemId = nil
        }
    }
}

private struct SwipeToDeleteRow<Content: View>: View {
    let id: String
    let isOpen: Bool
    let isEnabled: Bool
    let onOpenChange: (Bool) -> Void
    let onDelete: () -> Void
    let content: Content

    @State private var settledOffset: CGFloat = 0
    @GestureState private var dragOffset: CGFloat = 0

    private let actionWidth: CGFloat = 96
    private let openThreshold: CGFloat = 52

    init(
        id: String,
        isOpen: Bool,
        isEnabled: Bool,
        onOpenChange: @escaping (Bool) -> Void,
        onDelete: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) {
        self.id = id
        self.isOpen = isOpen
        self.isEnabled = isEnabled
        self.onOpenChange = onOpenChange
        self.onDelete = onDelete
        self.content = content()
    }

    var body: some View {
        Group {
            if isEnabled {
                ZStack(alignment: .trailing) {
                    deleteAction

                    content
                        .background(Theme.paper)
                        .contentShape(Rectangle())
                        .offset(x: currentOffset)
                }
                .highPriorityGesture(dragGesture)
            } else {
                content
                    .background(Theme.paper)
                    .contentShape(Rectangle())
            }
        }
        .onChange(of: isOpen) { _, open in
            guard isEnabled else {
                settledOffset = 0
                return
            }

            withAnimation(.spring(response: 0.24, dampingFraction: 0.9)) {
                settledOffset = open ? -actionWidth : 0
            }
        }
    }

    private var currentOffset: CGFloat {
        max(-actionWidth, min(0, settledOffset + dragOffset))
    }

    private var deleteAction: some View {
        Button(role: .destructive) {
            withAnimation(.spring(response: 0.22, dampingFraction: 0.92)) {
                settledOffset = 0
            }
            onOpenChange(false)
            onDelete()
        } label: {
            VStack(spacing: 6) {
                Image(systemName: "trash")
                    .font(.system(size: 15, weight: .semibold))

                Text("Delete")
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(.white)
            .frame(width: actionWidth)
            .frame(maxHeight: .infinity)
            .background(Theme.destructive)
        }
        .buttonStyle(.plain)
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 10, coordinateSpace: .local)
            .updating($dragOffset) { value, state, _ in
                guard abs(value.translation.width) > abs(value.translation.height) else { return }
                let translation = value.translation.width
                if settledOffset == 0, translation > 0 { return }
                state = translation
            }
            .onEnded { value in
                guard abs(value.translation.width) > abs(value.translation.height) else { return }

                let proposedOffset = max(-actionWidth, min(0, settledOffset + value.translation.width))
                let shouldOpen = proposedOffset <= -openThreshold

                withAnimation(.spring(response: 0.24, dampingFraction: 0.9)) {
                    settledOffset = shouldOpen ? -actionWidth : 0
                }
                onOpenChange(shouldOpen)
            }
    }
}

struct LibraryItemRow: View {
    let item: LibraryItem
    let metadata: LibraryItemMetadata
    let collectionCount: Int
    let isSelectionMode: Bool
    let isSelected: Bool
    let onSelect: () -> Void
    var showsPressFeedback: Bool = true

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("MMM d")
        return formatter
    }()

    var body: some View {
        if showsPressFeedback {
            Button(action: onSelect) {
                rowContent
            }
            .buttonStyle(PressableRowStyle())
        } else {
            rowContent
                .contentShape(Rectangle())
                .onTapGesture(perform: onSelect)
        }
    }

    private var rowContent: some View {
        HStack(alignment: .top, spacing: 12) {
            if isSelectionMode {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(isSelected ? Theme.accentPressed : Theme.muted.opacity(0.55))
                    .padding(.top, 2)
            }

            VStack(alignment: .leading, spacing: 8) {
                switch item {
                case .lyric(let file):
                    lyricRow(file: file)
                case .recording(let recording):
                    recordingRow(recording: recording)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(isSelected ? Theme.accentSoft.opacity(0.8) : Color.clear)
        .contentShape(Rectangle())
    }

    private func lyricRow(file: LyricFile) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            header(title: file.title.isEmpty ? "Untitled" : file.title, updatedAt: file.updatedAt)

            HStack(alignment: .lastTextBaseline, spacing: 8) {
                Text(lyricPreview(for: file))
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted.opacity(0.9))
                    .lineLimit(2)

                Spacer()

                itemIcon(systemName: "music.note", tint: Theme.accentPressed)
            }

            metadataRow
        }
    }

    private func recordingRow(recording: Recording) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            header(title: recording.title, updatedAt: recording.updatedAt)

            HStack(alignment: .lastTextBaseline, spacing: 8) {
                Text("\(recording.formattedDuration) · Saved \(Self.dateFormatter.string(from: recording.updatedAt))")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted.opacity(0.9))
                    .lineLimit(2)

                Spacer()

                itemIcon(systemName: "waveform", tint: Theme.accentPressed)
            }

            metadataRow
        }
    }

    private func header(title: String, updatedAt: Date) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)

            Spacer()

            Text(Self.dateFormatter.string(from: updatedAt))
                .font(.system(size: 11, weight: .semibold))
                .textCase(.uppercase)
                .tracking(1)
                .foregroundStyle(Theme.muted.opacity(0.8))
        }
    }

    private var metadataRow: some View {
        HStack(spacing: 8) {
            if metadata.isFavorite {
                metadataChip(label: "Favorite", systemImage: "star.fill", tint: Theme.accentPressed)
            }

            if metadata.isArchived {
                metadataChip(label: "Archived", systemImage: "archivebox.fill", tint: Theme.muted)
            }

            if collectionCount > 0 {
                metadataChip(
                    label: collectionCount == 1 ? "1 Collection" : "\(collectionCount) Collections",
                    systemImage: "folder.fill",
                    tint: Theme.accentPressed
                )
            }
        }
    }

    private func metadataChip(label: String, systemImage: String, tint: Color) -> some View {
        HStack(spacing: 5) {
            Image(systemName: systemImage)
                .font(.system(size: 10, weight: .semibold))
            Text(label)
                .font(.system(size: 10, weight: .semibold))
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(tint.opacity(0.1))
        .clipShape(Capsule())
    }

    private func lyricPreview(for file: LyricFile) -> String {
        let trimmed = file.body.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Every song starts somewhere." : trimmed
    }

    private func itemIcon(systemName: String, tint: Color) -> some View {
        Image(systemName: systemName)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: 20, height: 20)
    }
}

private struct LibraryItemManagementSheet: View {
    private enum LibraryBatchAction: String, CaseIterable, Identifiable {
        case favorite
        case unfavorite
        case archive
        case restore
        case delete

        var id: String { rawValue }

        var label: String {
            switch self {
            case .favorite:
                return "Favorite"
            case .unfavorite:
                return "Unfavorite"
            case .archive:
                return "Archive"
            case .restore:
                return "Restore"
            case .delete:
                return "Delete"
            }
        }

        var systemImage: String {
            switch self {
            case .favorite:
                return "star"
            case .unfavorite:
                return "star.slash"
            case .archive:
                return "archivebox"
            case .restore:
                return "tray.and.arrow.up"
            case .delete:
                return "trash"
            }
        }
    }

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var selectedItemIds: Set<String> = []
    @State private var selectedAction: LibraryBatchAction = .favorite
    @State private var isApplying = false
    @State private var showDeleteConfirmation = false

    private var items: [LibraryItem] {
        appState.allLibraryItems
    }

    private var selectedItems: [LibraryItem] {
        items.filter { selectedItemIds.contains($0.id) }
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
                        selectedItemIds = Set(items.map(\.id))
                    }
                    .secondaryButtonStyle()
                    .buttonStyle(PressableScaleStyle())

                    Button("Clear All") {
                        selectedItemIds.removeAll()
                    }
                    .secondaryButtonStyle()
                    .buttonStyle(PressableScaleStyle())
                }

                if items.isEmpty {
                    VStack(spacing: 8) {
                        Text("No library items yet")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Theme.ink)

                        Text("Create a lyric or recording first, then manage it here.")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.muted.opacity(0.82))
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(items, id: \.id) { item in
                                LibraryItemRow(
                                    item: item,
                                    metadata: appState.metadata(for: item),
                                    collectionCount: appState.collectionsContaining(item).count,
                                    isSelectionMode: true,
                                    isSelected: selectedItemIds.contains(item.id),
                                    onSelect: {
                                        toggle(item)
                                    },
                                    showsPressFeedback: false
                                )
                                .background(Theme.paper)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                                        .stroke(selectedItemIds.contains(item.id) ? Theme.accentPressed.opacity(0.3) : Theme.divider, lineWidth: 1)
                                )
                                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                            }
                        }
                    }
                }

                HStack(spacing: 10) {
                    Menu {
                        Picker("Action", selection: $selectedAction) {
                            ForEach(LibraryBatchAction.allCases) { action in
                                Label(action.label, systemImage: action.systemImage)
                                    .tag(action)
                            }
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: selectedAction.systemImage)
                                .font(.system(size: 15, weight: .semibold))

                            Text(selectedAction.label)
                                .lineLimit(1)

                            Image(systemName: "chevron.down")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Theme.muted.opacity(0.8))
                        }
                        .frame(minWidth: 120)
                    }
                    .secondaryButtonStyle()
                    .transaction { transaction in
                        transaction.animation = nil
                    }

                    Button {
                        if selectedAction == .delete {
                            showDeleteConfirmation = true
                        } else {
                            Task {
                                await applyAction()
                            }
                        }
                    } label: {
                        Text(isApplying ? "Applying..." : "Apply")
                            .frame(maxWidth: .infinity)
                    }
                    .primaryButtonStyle()
                    .buttonStyle(PressableScaleStyle())
                    .disabled(isApplying || selectedItems.isEmpty)
                    .opacity(isApplying || selectedItems.isEmpty ? 0.6 : 1)
                }
            }
            .padding(24)
            .background(Theme.paper)
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .alert("Delete selected items?", isPresented: $showDeleteConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    Task {
                        await applyAction()
                    }
                }
            } message: {
                Text("This action removes the selected library items.")
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

    private func applyAction() async {
        guard !selectedItems.isEmpty else { return }
        isApplying = true

        switch selectedAction {
        case .favorite:
            await MainActor.run {
                appState.setFavorite(true, for: selectedItems)
            }
        case .unfavorite:
            await MainActor.run {
                appState.setFavorite(false, for: selectedItems)
            }
        case .archive:
            await MainActor.run {
                appState.setArchived(true, for: selectedItems)
            }
        case .restore:
            await MainActor.run {
                appState.setArchived(false, for: selectedItems)
            }
        case .delete:
            await appState.deleteItems(selectedItems)
        }

        isApplying = false
        dismiss()
    }
}

struct PressableRowStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Theme.accentSoft : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
            .offset(y: configuration.isPressed ? 1 : 0)
    }
}

#Preview("Library (sample data)") {
    LibraryView()
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}
