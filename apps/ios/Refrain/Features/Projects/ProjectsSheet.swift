import SwiftUI

struct ProjectsSheet: View {
    private enum ProjectSortOption: String, CaseIterable, Identifiable {
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

    @State private var showNewProjectSheet = false
    @State private var sortOption: ProjectSortOption = .recentlyUpdated
    @State private var projectsExcludingLinkedItems: Set<Project.ID> = []
    @State private var includeLinkedItemsInNewProject = true

    private var assignedProjectIds: Set<String> {
        Set(appState.projectsContaining(item).map { $0.id })
    }

    private var sortedProjects: [Project] {
        switch sortOption {
        case .recentlyUpdated:
            return appState.projects.sorted { $0.updatedAt > $1.updatedAt }
        case .title:
            return appState.projects.sorted {
                $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
            }
        case .itemCount:
            return appState.projects.sorted {
                let lhs = appState.itemCount(for: $0).total
                let rhs = appState.itemCount(for: $1).total
                if lhs == rhs {
                    return $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending
                }
                return lhs > rhs
            }
        }
    }

    private var linkedItemsForNewProject: [LibraryItem] {
        appState.linkedItems(for: item)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Add to Project")
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
                        ForEach(ProjectSortOption.allCases) { option in
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

            if appState.projects.isEmpty {
                VStack(spacing: 10) {
                    Text("No projects")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink)

                    Text("Create one to start organizing.")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.muted.opacity(0.8))

                    Button {
                        showNewProjectSheet = true
                    } label: {
                        Text("Create Project")
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
                        ForEach(sortedProjects) { project in
                            let linkedItems = appState.linkedItemsNotInProject(for: item, project: project)
                            ProjectToggleRow(
                                project: project,
                                counts: appState.itemCount(for: project),
                                isSelected: assignedProjectIds.contains(project.id),
                                linkedItemCount: linkedItems.count,
                                includeLinkedItems: includeLinkedItemsBinding(for: project),
                                onToggle: { isSelected, includeLinkedItems in
                                    Task {
                                        if isSelected {
                                            await appState.addToProject(
                                                item,
                                                project: project,
                                                includeLinkedItems: includeLinkedItems
                                            )
                                        } else {
                                            await appState.removeFromProject(item, project: project)
                                        }
                                    }
                                }
                            )
                        }
                    }
                }
            }

            if !linkedItemsForNewProject.isEmpty {
                Toggle(isOn: $includeLinkedItemsInNewProject) {
                    Label(
                        linkedItemsForNewProject.count == 1 ? "Add linked file too" : "Add linked files too",
                        systemImage: "link"
                    )
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                }
                .tint(Theme.accentPressed)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
            }

            Button {
                showNewProjectSheet = true
            } label: {
                Text("New Project")
                    .frame(maxWidth: .infinity)
            }
            .primaryButtonStyle()
            .buttonStyle(PressableScaleStyle())
        }
        .padding(24)
        .background(Theme.paper)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .sheet(isPresented: $showNewProjectSheet) {
            NewProjectSheet { project in
                Task {
                    await appState.addToProject(
                        item,
                        project: project,
                        includeLinkedItems: includeLinkedItemsInNewProject && !linkedItemsForNewProject.isEmpty
                    )
                    await MainActor.run {
                        dismiss()
                    }
                }
            }
        }
    }

    private func includeLinkedItemsBinding(for project: Project) -> Binding<Bool> {
        Binding(
            get: { !projectsExcludingLinkedItems.contains(project.id) },
            set: { includeLinkedItems in
                if includeLinkedItems {
                    projectsExcludingLinkedItems.remove(project.id)
                } else {
                    projectsExcludingLinkedItems.insert(project.id)
                }
            }
        )
    }
}

struct ProjectToggleRow: View {
    let project: Project
    let counts: (total: Int, lyrics: Int, recordings: Int)
    let isSelected: Bool
    let linkedItemCount: Int
    @Binding var includeLinkedItems: Bool
    let onToggle: (Bool, Bool) -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button {
                onToggle(!isSelected, includeLinkedItems)
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(project.title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.ink)

                        if let description = project.description?.trimmingCharacters(in: .whitespacesAndNewlines),
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
            }
            .buttonStyle(PressableScaleStyle())

            if !isSelected && linkedItemCount > 0 {
                Divider()
                    .background(Theme.divider)

                Toggle(isOn: $includeLinkedItems) {
                    Label(
                        linkedItemCount == 1 ? "Also add linked file" : "Also add \(linkedItemCount) linked files",
                        systemImage: "link"
                    )
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                }
                .tint(Theme.accentPressed)
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
            }
        }
        .background(Theme.paper)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous)
                .stroke(Theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadiusSmall, style: .continuous))
    }

    private var countLabel: String {
        let totalLabel = counts.total == 1 ? "1 item" : "\(counts.total) items"
        return "\(totalLabel) · \(counts.lyrics) lyrics · \(counts.recordings) recordings"
    }
}

#Preview("Projects Sheet Populated") {
    ProjectsSheet(item: .lyric(AppState.previewLyric()))
        .environment(AppState.preview())
        .environment(\.isPreview, true)
}

#Preview("Projects Sheet Empty") {
    ProjectsSheet(item: .recording(Recording(title: "Voice memo idea")))
        .environment(AppState.preview(populated: false))
        .environment(\.isPreview, true)
}
