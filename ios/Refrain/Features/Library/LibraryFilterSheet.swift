import SwiftUI

struct LibraryFilterSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let onManageItems: (() -> Void)?

    @State private var contentHeight: CGFloat = 0
    @State private var draftItemTypeFilter: LibraryItemTypeFilter = .all
    @State private var draftSortOption: LibrarySortOption = .recentlyUpdated
    @State private var draftProjectFilter: Project.ID?

    init(onManageItems: (() -> Void)? = nil) {
        self.onManageItems = onManageItems
    }

    var body: some View {
        let hasSelections = hasSelections

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

            Picker("Item type", selection: $draftItemTypeFilter) {
                ForEach(LibraryItemTypeFilter.allCases) { itemType in
                    Text(itemType.label)
                        .tag(itemType)
                }
            }
            .pickerStyle(.segmented)
            .tint(Theme.accentPressed)

            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Sort by")
                        .font(.system(size: 11, weight: .semibold))
                        .textCase(.uppercase)
                        .tracking(1.2)
                        .foregroundStyle(Theme.muted.opacity(0.7))

                    Picker(selection: $draftSortOption) {
                        ForEach(LibrarySortOption.allCases) { option in
                            Text(option.label)
                                .tag(option)
                        }
                    } label: {
                        selectionFieldLabel(draftSortOption.label, horizontalPadding: 0)
                    }
                    .pickerStyle(.menu)
                    .buttonStyle(PressableScaleStyle())
                }
                .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                .layoutPriority(1)

                VStack(alignment: .trailing, spacing: 10) {
                    Text("Filter by")
                        .font(.system(size: 11, weight: .semibold))
                        .textCase(.uppercase)
                        .tracking(1.2)
                        .foregroundStyle(Theme.muted.opacity(0.7))
                        .frame(maxWidth: .infinity, alignment: .trailing)

                    Picker(selection: $draftProjectFilter) {
                        Text("All Items")
                            .tag(Optional<Project.ID>.none)

                        ForEach(appState.projects) { project in
                            Text(project.title)
                                .tag(Optional(project.id))
                        }
                    } label: {
                        selectionFieldLabel(
                            selectedProjectLabel(),
                            alignment: .trailing,
                            horizontalPadding: 0
                        )
                    }
                    .pickerStyle(.menu)
                    .buttonStyle(PressableScaleStyle())
                }
                .frame(width: 132, alignment: .trailing)
            }

            HStack(spacing: 12) {
                Button("Clear Filters") {
                    clearAndDismiss()
                }
                .secondaryButtonStyle()
                .buttonStyle(PressableScaleStyle())
                .frame(maxWidth: .infinity)
                .disabled(!hasSelections)
                .opacity(hasSelections ? 1 : 0.55)

                Button("Apply Filters") {
                    applyFilters()
                }
                .primaryButtonStyle()
                .buttonStyle(PressableScaleStyle())
                .frame(maxWidth: .infinity)
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
        .onAppear {
            syncDraftStateFromAppState()
        }
        .presentationDetents(contentHeight > 0 ? [.height(contentHeight)] : [.medium])
        .presentationDragIndicator(.visible)
    }

    private func selectedProjectLabel() -> String {
        if let selectedId = draftProjectFilter,
           let project = appState.projects.first(where: { $0.id == selectedId }) {
            return project.title
        }
        return "All Items"
    }

    private func selectionFieldLabel(
        _ title: String,
        alignment: Alignment = .leading,
        horizontalPadding: CGFloat = 14
    ) -> some View {
        HStack(spacing: 8) {
            if alignment == .trailing {
                Spacer(minLength: 0)
            }

            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)

            if alignment == .leading {
                Spacer(minLength: 0)
            }

            Image(systemName: "chevron.down")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.accentPressed)
        }
        .padding(.horizontal, horizontalPadding)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.paper)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                .stroke(Theme.accentPressed, lineWidth: 1.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
    }

    private var hasSelections: Bool {
        draftItemTypeFilter != .all ||
        draftSortOption != .recentlyUpdated ||
        draftProjectFilter != nil
    }

    private func syncDraftStateFromAppState() {
        draftItemTypeFilter = appState.selectedItemTypeFilter
        draftSortOption = appState.librarySortOption
        draftProjectFilter = appState.selectedProjectFilter
    }

    private func clearFilters() {
        draftItemTypeFilter = .all
        draftSortOption = .recentlyUpdated
        draftProjectFilter = nil
    }

    private func clearAndDismiss() {
        clearFilters()
        applyFilters()
    }

    private func applyFilters() {
        appState.selectedItemTypeFilter = draftItemTypeFilter
        appState.librarySortOption = draftSortOption
        appState.selectedProjectFilter = draftProjectFilter
        dismiss()
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
    state.selectedProjectFilter = AppState.previewProject().id
    state.librarySortOption = .favoritesFirst

    return LibraryFilterSheet()
        .environment(state)
        .environment(\.isPreview, true)
}
