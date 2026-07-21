import SwiftUI
import VisionKit

struct LibraryView: View {
    @Environment(AppState.self) private var appState

    let onCreate: () -> Void

    @State private var showFilterSheet = false
    @State private var showProfile = false
    @State private var showLyricScanner = false
    @State private var selectedItem: LibraryItem?
    @State private var projectSheetItem: LibraryItem?
    @State private var linkSheetItem: LibraryItem?
    @State private var showManageItemsSheet = false
    @State private var renamingItem: LibraryItem?
    @State private var deleteConfirmationItem: LibraryItem?
    @State private var openSwipeItemId: LibraryItem.ID?
    @State private var openSwipeSide: LibrarySwipeSide?
    @State private var renameDraft = ""
    @State private var scanDraft: LyricScanDraft?
    @State private var scanErrorMessage: String?
    @State private var isProcessingScan = false

    init(onCreate: @escaping () -> Void = {}) {
        self.onCreate = onCreate
    }

    private var visibleItems: [LibraryItem] {
        appState.filteredLibraryItems
    }

    private var hasLibraryItems: Bool {
        !appState.allLibraryItems.isEmpty
    }

    private var headerSubtitle: String {
        if !appState.searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Showing results for \"\(appState.searchQuery)\""
        }

        let count = visibleItems.count
        return "\(count) \(count == 1 ? "idea" : "ideas")"
    }

    private var hasActiveFilters: Bool {
        appState.selectedProjectFilter != nil ||
        appState.selectedItemTypeFilter != .all
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

    private var scanErrorIsPresented: Binding<Bool> {
        Binding(
            get: { scanErrorMessage != nil },
            set: { isPresented in
                if !isPresented {
                    scanErrorMessage = nil
                }
            }
        )
    }

    private var deleteConfirmationIsPresented: Binding<Bool> {
        Binding(
            get: { deleteConfirmationItem != nil },
            set: { isPresented in
                if !isPresented {
                    deleteConfirmationItem = nil
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

                        VStack(spacing: 0) {
                            if hasLibraryItems {
                                VStack(spacing: 16) {
                                    searchControlsRow

                                    if hasActiveFilters {
                                        managementSummary
                                    }

                                    if let feedback = appState.sharedImportFeedback {
                                        sharedImportBanner(feedback)
                                    }
                                }
                                .padding(.top, 22)
                                .padding(.horizontal, 20)
                                .padding(.bottom, 16)
                            }

                            ScrollView {
                                VStack(spacing: 16) {
                                    if visibleItems.isEmpty {
                                        emptyStateView
                                    } else {
                                        listView
                                    }
                                }
                                .padding(.horizontal, 20)
                                .padding(.bottom, 120)
                                .frame(maxWidth: .infinity)
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                        .background(Theme.paper)
                        .clipShape(
                            RoundedCorner(
                                radius: Theme.cornerRadiusSmall,
                                corners: [.topLeft, .topRight]
                            )
                        )
                        .shadow(color: Color.black.opacity(0.06), radius: 12, x: 0, y: 6)
                    }

                    if isProcessingScan {
                        scanProcessingOverlay
                    }
                }
            }
            .overlay(alignment: .bottom) {
                PrimaryTabBarContainer(onCreate: onCreate)
            }
            .ignoresSafeArea(.keyboard, edges: .bottom)
            .toolbar(.hidden, for: .navigationBar)
            .onChange(of: appState.pendingLibrarySelection) { _, newSelection in
                guard let newSelection else {
                    return
                }
                selectedItem = newSelection
                appState.pendingLibrarySelection = nil
            }
            .sheet(isPresented: $showFilterSheet) {
                LibraryFilterSheet {
                    showManageItemsSheet = true
                }
            }
            .sheet(isPresented: $showProfile) {
                ProfileView()
            }
            .sheet(isPresented: $showManageItemsSheet) {
                LibraryItemManagementSheet()
            }
            .sheet(isPresented: $showLyricScanner) {
                LyricDocumentCameraSheet(
                    isPresented: $showLyricScanner,
                    onScan: handleScan,
                    onCancel: {},
                    onError: { error in
                        scanErrorMessage = error.localizedDescription
                    }
                )
                .ignoresSafeArea()
            }
            .sheet(item: $projectSheetItem) { item in
                ProjectsSheet(item: item)
            }
            .sheet(item: $linkSheetItem) { item in
                LinkItemSheet(sourceItem: item)
            }
            .sheet(item: $scanDraft) { draft in
                LyricScanReviewSheet(draft: draft) { file in
                    selectedItem = .lyric(file)
                    scanDraft = nil
                }
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
            .alert("Delete Item?", isPresented: deleteConfirmationIsPresented) {
                Button("Cancel", role: .cancel) {
                    deleteConfirmationItem = nil
                }

                Button("Delete", role: .destructive) {
                    guard let item = deleteConfirmationItem else { return }
                    deleteConfirmationItem = nil
                    Task {
                        await deleteItem(item)
                    }
                }
            } message: {
                Text("This removes the item from your library, projects, and links.")
            }
            .alert("Unable to Scan", isPresented: scanErrorIsPresented) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(scanErrorMessage ?? "Please try again.")
            }
        }
    }

    private func headerView(topInset: CGFloat) -> some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Library")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(Theme.headerTitle)

                Text(headerSubtitle)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.headerSubtitle)
            }

            Spacer()

            HStack(spacing: 12) {
                Button {
                    showManageItemsSheet = true
                } label: {
                    Label("Manage", systemImage: "checklist")
                        .font(.system(size: 12, weight: .semibold))
                        .textCase(.uppercase)
                        .tracking(1.2)
                        .foregroundStyle(Theme.headerTitle)
                }
                .buttonStyle(PressableScaleStyle())

                Button {
                    showProfile = true
                } label: {
                    UserAvatar(user: appState.currentUser)
                }
            }
            .buttonStyle(PressableScaleStyle())
        }
        .padding(.top, 6)
        .padding(.horizontal, 20)
        .padding(.bottom, 28)
    }

    private var searchControlsRow: some View {
        HStack(spacing: 12) {
            SearchBar(text: Binding(
                get: { appState.searchQuery },
                set: { appState.searchQuery = $0 }
            ), placeholder: "Search ideas")
            .frame(maxWidth: .infinity)

            Button {
                startScanFlow()
            } label: {
                Image(systemName: "doc.text.viewfinder")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(Theme.accentPressed)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(PressableScaleStyle())

            Button {
                showFilterSheet = true
            } label: {
                Image(systemName: "line.3.horizontal.decrease.circle")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(filterIconTint)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(PressableScaleStyle())
        }
    }

    private var filterIconTint: Color {
        if hasActiveFilters || appState.librarySortOption != .recentlyUpdated {
            return Theme.accentPressed
        }
        return Theme.muted.opacity(0.75)
    }

    private var managementSummary: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if appState.selectedItemTypeFilter != .all {
                    summaryChip(label: appState.selectedItemTypeFilter.label)
                }

                if let projectID = appState.selectedProjectFilter,
                   let project = appState.projects.first(where: { $0.id == projectID }) {
                    summaryChip(label: project.title)
                }
            }
        }
    }

    private func sharedImportBanner(_ feedback: SharedImportFeedback) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: "square.and.arrow.down.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.accentPressed)

            Text(feedback.message)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Theme.ink)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let latestItem = feedback.latestItem {
                Button("Open") {
                    selectedItem = latestItem
                    appState.sharedImportFeedback = nil
                }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.accentPressed)
            }

            Button {
                appState.sharedImportFeedback = nil
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.muted)
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color(hex: "EEF4FF"))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color(hex: "C7D7FF"), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
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
        VStack(spacing: 14) {
            Image("RefrainBird")
                .resizable()
                .scaledToFit()
                .frame(height: 110)
                .padding(.top, 4)
                .shadow(color: Color.black.opacity(0.08), radius: 10, x: 0, y: 6)

            Text(appState.archiveFilter == .archivedOnly ? "No archived ideas yet." : "This is your first idea.")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)

            Text(
                appState.archiveFilter == .archivedOnly
                ? "Archived songs and memos will appear here."
                : "Every song starts somewhere."
            )
            .font(.system(size: 14))
            .foregroundStyle(Theme.muted.opacity(0.9))
            .multilineTextAlignment(.center)

            if appState.archiveFilter != .archivedOnly {
                HStack(spacing: 10) {
                    Button {
                        Task {
                            if let file = await appState.createLyricFile() {
                                selectedItem = .lyric(file)
                            }
                        }
                    } label: {
                        emptyStateActionLabel(title: "Create lyric", systemImage: "square.and.pencil")
                    }
                    .buttonStyle(PressableScaleStyle())

                    Button {
                        startScanFlow()
                    } label: {
                        emptyStateActionLabel(title: "Scan lyrics", systemImage: "doc.text.viewfinder")
                    }
                    .buttonStyle(PressableScaleStyle())
                }
                .padding(.top, 6)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .padding(.horizontal, 18)
        .background(Theme.accentSoft)
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
    }

    private var scanProcessingOverlay: some View {
        ZStack {
            Color.black.opacity(0.16)
                .ignoresSafeArea()

            VStack(spacing: 14) {
                ProgressView()
                    .tint(Theme.accentPressed)

                Text("Scanning lyrics...")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.ink)

                Text("Refrain is converting your document into editable text.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 220)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 22)
            .background(Theme.paper)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous)
                    .stroke(Theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            .shadow(color: Color.black.opacity(0.1), radius: 18, x: 0, y: 10)
        }
    }

    private func emptyStateActionLabel(title: String, systemImage: String) -> some View {
        Label(title, systemImage: systemImage)
            .font(.system(size: 11, weight: .semibold))
            .textCase(.uppercase)
            .tracking(1.6)
            .foregroundStyle(Theme.accentPressed)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Color(hex: "E8EBFF"))
            .overlay(
                Capsule()
                    .stroke(Color(hex: "C7D1FF"), lineWidth: 1)
            )
            .clipShape(Capsule())
    }

    private func startScanFlow() {
        guard LyricScanService.isSupported else {
            scanErrorMessage = LyricScanError.scannerUnavailable.localizedDescription
            return
        }

        showLyricScanner = true
    }

    private func handleScan(_ scan: VNDocumentCameraScan) {
        isProcessingScan = true

        Task {
            do {
                let draft = try await LyricScanService.recognizeText(from: scan)
                await MainActor.run {
                    isProcessingScan = false
                    scanDraft = draft
                }
            } catch {
                await MainActor.run {
                    isProcessingScan = false
                    scanErrorMessage = error.localizedDescription
                }
            }
        }
    }

    private var listView: some View {
        LazyVStack(spacing: 0) {
            ForEach(Array(visibleItems.enumerated()), id: \.element.id) { index, item in
                SwipeableLibraryItemRow(
                    isOpen: openSwipeItemId == item.id,
                    openSide: openSwipeItemId == item.id ? openSwipeSide : nil,
                    leadingTitle: appState.isFavorite(item) ? "Unfavorite" : "Favorite",
                    leadingSystemImage: appState.isFavorite(item) ? "star.slash" : "star",
                    trailingPrimaryTitle: appState.isArchived(item) ? "Restore" : "Archive",
                    trailingPrimarySystemImage: appState.isArchived(item) ? "tray.and.arrow.up" : "archivebox",
                    onOpenSideChange: { side in
                        setOpenSwipeSide(side, for: item)
                    },
                    onLeadingAction: {
                        closeSwipeActions()
                        toggleFavorite(for: item)
                    },
                    onTrailingPrimaryAction: {
                        closeSwipeActions()
                        toggleArchived(for: item)
                    },
                    onDelete: {
                        closeSwipeActions()
                        confirmDelete(item)
                    }
                ) {
                    LibraryItemRow(
                        item: item,
                        metadata: appState.metadata(for: item),
                        collectionCount: appState.projectsContaining(item).count,
                        isSelectionMode: false,
                        isSelected: false,
                        onSelect: {
                            selectItem(item)
                        },
                        showsPressFeedback: true
                    )
                }
                .overlay(alignment: .bottom) {
                    if index < visibleItems.count - 1 {
                        Rectangle()
                            .fill(Theme.divider)
                            .frame(height: 1)
                    }
                }
                .contextMenu {
                    contextMenuContent(for: item)
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
            projectSheetItem = item
        } label: {
            Label("Add to Project", systemImage: "folder.badge.plus")
        }

        Button {
            linkSheetItem = item
        } label: {
            Label(item.isRecording ? "Link Lyric" : "Link Recording", systemImage: "link.badge.plus")
        }

        Divider()

        Button(role: .destructive) {
            confirmDelete(item)
        } label: {
            Label("Delete", systemImage: "trash")
        }
    }

    private func beginRenaming(_ item: LibraryItem) {
        renamingItem = item
        renameDraft = item.title
    }

    private func selectItem(_ item: LibraryItem) {
        guard openSwipeItemId == nil else {
            closeSwipeActions()
            return
        }

        selectedItem = item
    }

    private func setOpenSwipeSide(_ side: LibrarySwipeSide?, for item: LibraryItem) {
        guard let side else {
            closeSwipeActions()
            return
        }

        openSwipeItemId = item.id
        openSwipeSide = side
    }

    private func closeSwipeActions() {
        openSwipeItemId = nil
        openSwipeSide = nil
    }

    private func confirmDelete(_ item: LibraryItem) {
        deleteConfirmationItem = item
    }

    private func toggleFavorite(for item: LibraryItem) {
        appState.setFavorite(!appState.isFavorite(item), for: item)
    }

    private func toggleArchived(for item: LibraryItem) {
        appState.setArchived(!appState.isArchived(item), for: item)
    }

    private func deleteItem(_ item: LibraryItem) async {
        switch item {
        case .lyric(let file):
            await appState.deleteLyricFile(file)
        case .recording(let recording):
            await appState.deleteRecording(recording)
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
                    label: collectionCount == 1 ? "1 Project" : "\(collectionCount) Projects",
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

private enum LibrarySwipeSide: Equatable {
    case leading
    case trailing
}

private enum LibrarySwipeMetrics {
    static let leadingRevealWidth: CGFloat = 96
    static let trailingActionWidth: CGFloat = 84
    static let trailingRevealWidth: CGFloat = trailingActionWidth * 2
    static let leadingOpenThreshold: CGFloat = 44
    static let trailingOpenThreshold: CGFloat = 56
    static let leadingFullSwipeThreshold: CGFloat = 170
    static let overdragWidth: CGFloat = 72
}

private struct SwipeableLibraryItemRow<Content: View>: View {
    let isOpen: Bool
    let openSide: LibrarySwipeSide?
    let leadingTitle: String
    let leadingSystemImage: String
    let trailingPrimaryTitle: String
    let trailingPrimarySystemImage: String
    let onOpenSideChange: (LibrarySwipeSide?) -> Void
    let onLeadingAction: () -> Void
    let onTrailingPrimaryAction: () -> Void
    let onDelete: () -> Void

    private let content: Content

    @GestureState private var dragOffset: CGFloat = 0

    init(
        isOpen: Bool,
        openSide: LibrarySwipeSide?,
        leadingTitle: String,
        leadingSystemImage: String,
        trailingPrimaryTitle: String,
        trailingPrimarySystemImage: String,
        onOpenSideChange: @escaping (LibrarySwipeSide?) -> Void,
        onLeadingAction: @escaping () -> Void,
        onTrailingPrimaryAction: @escaping () -> Void,
        onDelete: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) {
        self.isOpen = isOpen
        self.openSide = openSide
        self.leadingTitle = leadingTitle
        self.leadingSystemImage = leadingSystemImage
        self.trailingPrimaryTitle = trailingPrimaryTitle
        self.trailingPrimarySystemImage = trailingPrimarySystemImage
        self.onOpenSideChange = onOpenSideChange
        self.onLeadingAction = onLeadingAction
        self.onTrailingPrimaryAction = onTrailingPrimaryAction
        self.onDelete = onDelete
        self.content = content()
    }

    var body: some View {
        ZStack {
            leadingActions
            trailingActions

            content
                .background(Theme.paper)
                .offset(x: displayedOffset)
                .simultaneousGesture(horizontalSwipeGesture)
                .animation(.spring(response: 0.26, dampingFraction: 0.88), value: restingOffset)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .clipped()
    }

    private var leadingActions: some View {
        HStack(spacing: 0) {
            actionButton(
                title: leadingTitle,
                systemImage: leadingSystemImage,
                background: Theme.accentPressed,
                width: LibrarySwipeMetrics.leadingRevealWidth,
                action: onLeadingAction
            )

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.accentPressed)
    }

    private var trailingActions: some View {
        HStack(spacing: 0) {
            Spacer(minLength: 0)

            actionButton(
                title: trailingPrimaryTitle,
                systemImage: trailingPrimarySystemImage,
                background: Theme.muted,
                width: LibrarySwipeMetrics.trailingActionWidth,
                action: onTrailingPrimaryAction
            )

            actionButton(
                title: "Delete",
                systemImage: "trash",
                background: Theme.destructive,
                width: LibrarySwipeMetrics.trailingActionWidth,
                action: onDelete
            )
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
        .background(Theme.destructive)
    }

    private func actionButton(
        title: String,
        systemImage: String,
        background: Color,
        width: CGFloat,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 5) {
                Image(systemName: systemImage)
                    .font(.system(size: 16, weight: .semibold))

                Text(title)
                    .font(.system(size: 11, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
            .foregroundStyle(.white)
            .frame(width: width)
            .frame(maxHeight: .infinity)
        }
        .buttonStyle(.plain)
        .background(background)
    }

    private var restingOffset: CGFloat {
        guard isOpen, let openSide else {
            return 0
        }

        switch openSide {
        case .leading:
            return LibrarySwipeMetrics.leadingRevealWidth
        case .trailing:
            return -LibrarySwipeMetrics.trailingRevealWidth
        }
    }

    private var displayedOffset: CGFloat {
        let rawOffset = restingOffset + dragOffset
        let minimumOffset = -LibrarySwipeMetrics.trailingRevealWidth - LibrarySwipeMetrics.overdragWidth
        let maximumOffset = LibrarySwipeMetrics.leadingRevealWidth + LibrarySwipeMetrics.overdragWidth

        return min(max(rawOffset, minimumOffset), maximumOffset)
    }

    private var horizontalSwipeGesture: some Gesture {
        DragGesture(minimumDistance: 12)
            .updating($dragOffset) { value, state, _ in
                guard isHorizontalDrag(value) else {
                    return
                }

                state = value.translation.width
            }
            .onEnded { value in
                guard isHorizontalDrag(value) else {
                    return
                }

                finishDrag(value)
            }
    }

    private func finishDrag(_ value: DragGesture.Value) {
        let finalOffset = restingOffset + value.translation.width
        let predictedOffset = restingOffset + value.predictedEndTranslation.width

        if max(finalOffset, predictedOffset) >= LibrarySwipeMetrics.leadingFullSwipeThreshold {
            onLeadingAction()
            return
        }

        if finalOffset >= LibrarySwipeMetrics.leadingOpenThreshold {
            onOpenSideChange(.leading)
        } else if finalOffset <= -LibrarySwipeMetrics.trailingOpenThreshold {
            onOpenSideChange(.trailing)
        } else {
            onOpenSideChange(nil)
        }
    }

    private func isHorizontalDrag(_ value: DragGesture.Value) -> Bool {
        let horizontalDistance = abs(value.translation.width)
        let verticalDistance = abs(value.translation.height)

        return horizontalDistance > verticalDistance * 1.2
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
                                    collectionCount: appState.projectsContaining(item).count,
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
