import SwiftUI

struct LibraryFilterSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var contentHeight: CGFloat = 0

    var body: some View {
        @Bindable var state = appState

        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Filters")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Theme.ink)

                Spacer()

                Button("Close") {
                    dismiss()
                }
                .font(.system(size: 12, weight: .semibold))
                .textCase(.uppercase)
                .tracking(1.2)
                .foregroundStyle(Theme.muted)
            }

            Picker("Item type", selection: $state.selectedItemTypeFilter) {
                ForEach(LibraryItemTypeFilter.allCases) { itemType in
                    Text(itemType.label)
                        .tag(itemType)
                }
            }
            .pickerStyle(.segmented)
            .tint(Theme.accentPressed)
            .padding(2)
            .background(Theme.headerBackground)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))

            VStack(alignment: .leading, spacing: 10) {
                Text("Sort by")
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(.uppercase)
                    .tracking(1.2)
                    .foregroundStyle(Theme.muted.opacity(0.7))

                Picker("Sort by", selection: $state.librarySortOption) {
                    ForEach(LibrarySortOption.allCases) { option in
                        Text(option.label)
                            .tag(option)
                    }
                }
                .pickerStyle(.menu)
                .tint(Theme.accentPressed)
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Show")
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(.uppercase)
                    .tracking(1.2)
                    .foregroundStyle(Theme.muted.opacity(0.7))

                Picker("Archive status", selection: $state.archiveFilter) {
                    ForEach(LibraryArchiveFilter.allCases) { option in
                        Text(option.label)
                            .tag(option)
                    }
                }
                .pickerStyle(.segmented)
                .tint(Theme.accentPressed)
                .padding(2)
                .background(Theme.headerBackground)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Filter by Collection")
                    .font(.system(size: 11, weight: .semibold))
                    .textCase(.uppercase)
                    .tracking(1.2)
                    .foregroundStyle(Theme.muted.opacity(0.7))

                Picker(selection: $state.selectedCollectionFilter) {
                    Text("All Items")
                        .tag(Optional<Collection.ID>.none)

                    ForEach(appState.collections) { collection in
                        Text(collection.title)
                            .tag(Optional(collection.id))
                    }
                } label: {
                    HStack {
                        Text(selectedCollectionLabel())
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.ink)

                        Spacer()

                        Image(systemName: "chevron.down")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.accentPressed)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.paper)
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                            .stroke(Theme.accentPressed, lineWidth: 1.5)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
                }
                .pickerStyle(.menu)
                .buttonStyle(PressableScaleStyle())
                .onChange(of: state.selectedCollectionFilter) { _, _ in
                    dismiss()
                }
            }
        }
        .padding(24)
        .background(Theme.paper)
        .background(
            GeometryReader { proxy in
                Color.clear
                    .preference(key: SheetHeightKey.self, value: proxy.size.height)
            }
        )
        .onPreferenceChange(SheetHeightKey.self) { height in
            if height > 0, abs(height - contentHeight) > 1 {
                contentHeight = height
            }
        }
        .presentationDetents(contentHeight > 0 ? [.height(contentHeight)] : [.medium])
        .presentationDragIndicator(.visible)
    }

    private func selectedCollectionLabel() -> String {
        if let selectedId = appState.selectedCollectionFilter,
           let collection = appState.collections.first(where: { $0.id == selectedId }) {
            return collection.title
        }
        return "All Items"
    }
}

private struct SheetHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

#Preview("Library Filters Default") {
    LibraryFilterSheet()
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}

#Preview("Library Filters Active") {
    let state = AppState.preview()
    state.selectedItemTypeFilter = .recordings
    state.selectedCollectionFilter = AppState.previewCollection().id
    state.librarySortOption = .favoritesFirst
    state.archiveFilter = .all

    return LibraryFilterSheet()
        .environment(state)
        .environment(\.isPreview, true)
}
