// pr.yml test (validate CI test schedule in skills.json)
// const fs = require('fs');
// const path = require('path');

// // Get all skill directories from output/<plugin>/skills/
// const outputDir = "output";
// const pluginDirs = fs.readdirSync(outputDir)
//   .filter(f => fs.statSync(path.join(outputDir, f)).isDirectory());

// const pluginSkillDirPathsMap = pluginDirs.reduce((acc, pluginDir) => {
//   const pluginSkillsDir = path.join(outputDir, pluginDir, "skills");
//   if (!fs.existsSync(pluginSkillsDir) || !fs.statSync(pluginSkillsDir).isDirectory()) {
//     acc[pluginDir] = [];
//     return acc;
//   }

//   acc[pluginDir] = fs.readdirSync(pluginSkillsDir)
//     .filter(f => fs.statSync(path.join(pluginSkillsDir, f)).isDirectory())
//     .map(skillDir => path.join(pluginSkillsDir, skillDir));
//   return acc;
// }, {});

// const skillDirs = Object.values(pluginSkillDirPathsMap)
//   .flat()
//   .map(skillPath => path.basename(skillPath))
//   .sort();

// // Read skills.json
// const skillsJson = JSON.parse(fs.readFileSync('tests/skills.json', 'utf8'));
// const jsonPlugins = [...skillsJson.plugins].sort();
// const jsonSkills = jsonPlugins.map(p => p.skills).flat().sort();

// let hasError = false;

// // 1. skills.json enumerates all skills 
// const skillDirsStr = JSON.stringify(skillDirs);
// const jsonSkillsStr = JSON.stringify(jsonSkills);
// if (skillDirsStr !== jsonSkillsStr) {
//   console.log();
//   console.log("skills in skills.json doesn't match available skills in output/skills/");
//   hasError = true;
// }

// // 2. Integration test schedule coverages all skills
// // Only consider the active cron schedules from .github/workflows/integration-tests.yml
// const activeCronSchedules = [
//   '0 5 * * 2-6',
//   '0 8 * * 2-6',
//   '0 12 * * 2-6',
// ];
// let scheduledSkills = [];
// jsonPlugins.forEach(p => {
//   activeCronSchedules.forEach(cron => {
//     const value = p.integrationTestSchedule[cron];
//     if (value) {
//       value.split(',').forEach(s => scheduledSkills.push(s));
//     }
//   });
// });

// scheduledSkills = scheduledSkills.sort();

// const scheduledSkillsStr = JSON.stringify(scheduledSkills);
// if (skillDirsStr !== scheduledSkillsStr) {
//   console.log("skillDirs", JSON.stringify(skillDirs));
//   console.log("scheduledSkills", JSON.stringify(scheduledSkills));
//   console.log("integrationTestSchedule in skills.json doesn't match available skills in output/skills/");
//   hasError = true;
// }

