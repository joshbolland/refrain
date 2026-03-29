import SwiftUI

struct CollectionsSheet: View {
    private enum CollectionSortOption: String, CaseIterable, Identifiable {
        case recentlyUpdated
        case title
        case itemCount

        var id: String { rawValue }

        var label: String {
            switch self {
            case .recentlyUpdated:
                return "Recently Updated"
            case .title:
                return "Title"
            case .itemCount:
                return "Item Count"
            }
        }

        var systemImage: String {
            switch self {
            case .recentlyUpdated:
                return "clock.arrow.circlepath"
            case .title:
                return "textformat"
            case .itemCount:
                return "square.stack.3d.up"
            }
        }
    }

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let item: LibraryItem

    @State private var showNewCollectionSheet = false
    @State private var sortOption: CollectionSortOption = .recentlyUpdated

    private var assignedCollectionIds: Set<String> {
        Set(appState.collectionsContaining(item).map { $0.id })
    }

    private var sortedCollections: [Collection] {
        switch sortOption {
        case .recentlyUpdated:
            return appState.collections.sorted { $0.updatedAt > $1.updatedAt }
        case .title:
            return appState.collections.sorted {
                $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
            }
        case .itemCount:
            return appState.collections.sorted {
                let lhs = appState.itemCount(for: $0).total
                let rhs = appState.itemCount(for: $1).total
                if lhs == rhs {
                    return $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
                }
                return lhs > rhs
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Add to Collection")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Theme.ink)

                    Text(item.title)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.muted.opacity(0.85))
                        .lineLimit(1)
                }

                Spacer()

                Menu {
                    Picker("Sort", selection: $sortOption) {
                        ForEach(CollectionSortOption.allCases) { option in
                            Label(option.label, systemImage: option.systemImage)
                                .tag(option)
                        }
                    }
                } label: {
                    Image(systemName: "arrow.up.arrow.down.circle")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                }
                .buttonStyle(.plain)

                Button("Close") {
                    dismiss()
                }
                .font(.system(size: 12, weight: .semibold))
                .textCase(.uppercase)
                .tracking(1.2)
                .foregroundStyle(Theme.muted)
            }

            if appState.collections.isEmpty {
                VStack(spacing: 10) {
                    Text("No collections")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)

                    Text("Create one to start organizing.")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.muted.opacity(0.8))

                    Button {
                        showNewCollectionSheet = true
                    } label: {
                        Text("Create Collection")
                            .frame(maxWidth: .infinity)
                    }
                    .secondaryButtonStyle()
                    .buttonStyle(PressableScaleStyle())
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .padding(.horizontal, 12)
                .background(Theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius, style: .continuous))
            } else {
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(sortedCollections) { collection in
                            CollectionToggleRow(
                                collection: collection,
                                counts: appState.itemCount(for: collection),
                                isSelected: assignedCollectionIds.contains(collection.id),
                                onToggle: { isSelected in
                                    Task {
                                        if isSelected {
                                            await appState.addToCollection(item, collection: collection)
                                        } else {
                                            await appState.removeFromCollection(item, collection: collection)
                                        }
                                    }
                                }
                            )
                        }
                    }
                }
            }

            Button {
                showNewCollectionSheet = true
            } label: {
                Text("New Collection")
                    .frame(maxWidth: .infinity)
            }
            .primaryButtonStyle()
            .buttonStyle(PressableScaleStyle())
        }
        .padding(24)
        .background(Theme.paper)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .sheet(isPresented: $showNewCollectionSheet) {
            NewCollectionSheet { collection in
                Task {
                    await appState.addToCollection(item, collection: collection)
                    await MainActor.run {
                        dismiss()
                    }
                }
            }
        }
    }
}

struct CollectionToggleRow: View {
    let collection: Collection
    let counts: (total: Int, lyrics: Int, recordings: Int)
    let isSelected: Bool
    let onToggle: (Bool) -> Void

    var body: some View {
        Button {
            onToggle(!isSelected)
        } label: {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(collection.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.ink)

                    if let description = collection.description?.trimmingCharacters(in: .whitespacesAndNewlines),
                       !description.isEmpty {
                        Text(description)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.muted.opacity(0.82))
                            .lineLimit(2)
                    }

                    Text(countLabel)
                        .font(.system(size: 11, weight: .semibold))
                        .textCase(.uppercase)
                        .tracking(1)
                        .foregroundStyle(Theme.muted.opacity(0.72))
                }

                Spacer(minLength: 12)

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? Theme.accent : Theme.muted.opacity(0.6))
                    .padding(.top, 2)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.paper)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                    .stroke(Theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
        }
        .buttonStyle(PressableScaleStyle())
    }

    private var countLabel: String {
        let totalLabel = counts.total == 1 ? "1 item" : "\(counts.total) items"
        return "\(totalLabel) · \(counts.lyrics) lyrics · \(counts.recordings) recordings"
    }
}

#Preview("Collections Sheet Populated") {
    CollectionsSheet(item: .lyric(AppState.previewLyric()))
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}

#Preview("Collections Sheet Empty") {
    CollectionsSheet(item: .recording(Recording(title: "Voice memo idea")))
        .environment(AppState.preview(populated: false))
        .environment(\.isPreview, true)
}
