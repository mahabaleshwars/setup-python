import * as path from 'path';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as httpm from '@actions/http-client';
import {ExecOptions} from '@actions/exec/lib/interfaces';
import {IS_WINDOWS, IS_LINUX, getDownloadFileName} from './utils';
import {IToolRelease} from '@actions/tool-cache'; // Adjust the import path as needed

const TOKEN = core.getInput('token');
const AUTH = !TOKEN ? undefined : `token ${TOKEN}`;
const MANIFEST_REPO_OWNER = 'actions';
const MANIFEST_REPO_NAME = 'python-versions';
const MANIFEST_REPO_BRANCH = 'main';
export const MANIFEST_URL = `https://raw.githubusercontent.com/${MANIFEST_REPO_OWNER}/${MANIFEST_REPO_NAME}/${MANIFEST_REPO_BRANCH}/versions-manifest.json`;

export async function findReleaseFromManifest(
  semanticVersionSpec: string,
  architecture: string,
  manifest: tc.IToolRelease[] | null
): Promise<tc.IToolRelease | undefined> {
  if (!manifest) {
    manifest = await getManifest();
  }

  const foundRelease = await tc.findFromManifest(
    semanticVersionSpec,
    false,
    manifest,
    architecture
  );

  return foundRelease;
}

function isIToolRelease(obj: any): obj is IToolRelease {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.version === 'string' &&
    typeof obj.stable === 'boolean' &&
    Array.isArray(obj.files) &&
    obj.files.every(
      (file: any) =>
        typeof file.filename === 'string' &&
        typeof file.platform === 'string' &&
        typeof file.arch === 'string' &&
        typeof file.download_url === 'string'
    )
  );
}

export async function getManifest(): Promise<tc.IToolRelease[]> {
  try {
    // const repoManifest = {
    //   sha: '5418fd77743bd877e972056787b3ee67a5725566',
    //   node_id:
    //     'MDQ6QmxvYjI1MDA3NzkzMzo1NDE4ZmQ3Nzc0M2JkODc3ZTk3MjA1Njc4N2IzZWU2N2E1NzI1NTY2',
    //   size: 296984,
    //   url: 'https://api.github.com/repos/actions/python-versions/git/blobs/5418fd77743bd877e972056787b3ee67a5725566',
    //   content:
    //     'WwogIHsKICAgICJ2ZXJzaW9uIjogIjMuMTQuMC1hbHBoYS4wIiwKICAgICJz\ndGFibGUiOiBmYWxzZSwKICAgICJyZWxlYXNlX3VybCI6ICJodHRwczovL2dp\ndGh1Yi5jb20vYWN0aW9ucy9weXRob24tdmVyc2lvbnMvcmVsZWFzZXMvdGFn\nLzMuMTQuMC1hbHBoYS4wLTEwNjE2NzIwOTU4IiwKICAgICJmaWxlcyI6IFsK\nICAgICAgewogICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy4xNC4wLWFs\ncGhhLjAtbGludXgtMjAuMDQteDY0LnRhci5neiIsCiAgICAgICAgImFyY2gi\nOiAieDY0IiwKICAgICAgICAicGxhdGZvcm0iOiAibGludXgiLAogICAgICAg\nICJwbGF0Zm9ybV92ZXJzaW9uIjogIjIwLjA0IiwKICAgICAgICAiZG93bmxv\nYWRfdXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12\nZXJzaW9ucy9yZWxlYXNlcy9kb3dubG9hZC8zLjE0LjAtYWxwaGEuMC0xMDYx\nNjcyMDk1OC9weXRob24tMy4xNC4wLWFscGhhLjAtbGludXgtMjAuMDQteDY0\nLnRhci5neiIKICAgICAgfSwKICAgICAgewogICAgICAgICJmaWxlbmFtZSI6\nICJweXRob24tMy4xNC4wLWFscGhhLjAtbGludXgtMjIuMDQtYXJtNjQudGFy\nLmd6IiwKICAgICAgICAiYXJjaCI6ICJhcm02NCIsCiAgICAgICAgInBsYXRm\nb3JtIjogImxpbnV4IiwKICAgICAgICAicGxhdGZvcm1fdmVyc2lvbiI6ICIy\nMi4wNCIsCiAgICAgICAgImRvd25sb2FkX3VybCI6ICJodHRwczovL2dpdGh1\nYi5jb20vYWN0aW9ucy9weXRob24tdmVyc2lvbnMvcmVsZWFzZXMvZG93bmxv\nYWQvMy4xNC4wLWFscGhhLjAtMTA2MTY3MjA5NTgvcHl0aG9uLTMuMTQuMC1h\nbHBoYS4wLWxpbnV4LTIyLjA0LWFybTY0LnRhci5neiIKICAgICAgfSwKICAg\nICAgewogICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy4xNC4wLWFscGhh\nLjAtbGludXgtMjIuMDQteDY0LnRhci5neiIsCiAgICAgICAgImFyY2giOiAi\neDY0IiwKICAgICAgICAicGxhdGZvcm0iOiAibGludXgiLAogICAgICAgICJw\nbGF0Zm9ybV92ZXJzaW9uIjogIjIyLjA0IiwKICAgICAgICAiZG93bmxvYWRf\ndXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12ZXJz\naW9ucy9yZWxlYXNlcy9kb3dubG9hZC8zLjE0LjAtYWxwaGEuMC0xMDYxNjcy\nMDk1OC9weXRob24tMy4xNC4wLWFscGhhLjAtbGludXgtMjIuMDQteDY0LnRh\nci5neiIKICAgICAgfSwKICAgICAgewogICAgICAgICJmaWxlbmFtZSI6ICJw\neXRob24tMy4xNC4wLWFscGhhLjAtbGludXgtMjQuMDQtYXJtNjQudGFyLmd6\nIiwKICAgICAgICAiYXJjaCI6ICJhcm02NCIsCiAgICAgICAgInBsYXRmb3Jt\nIjogImxpbnV4IiwKICAgICAgICAicGxhdGZvcm1fdmVyc2lvbiI6ICIyNC4w\nNCIsCiAgICAgICAgImRvd25sb2FkX3VybCI6ICJodHRwczovL2dpdGh1Yi5j\nb20vYWN0aW9ucy9weXRob24tdmVyc2lvbnMvcmVsZWFzZXMvZG93bmxvYWQv\nMy4xNC4wLWFscGhhLjAtMTA2MTY3MjA5NTgvcHl0aG9uLTMuMTQuMC1hbHBo\nYS4wLWxpbnV4LTI0LjA0LWFybTY0LnRhci5neiIKICAgICAgfSwKICAgICAg\newogICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy4xNC4wLWFscGhhLjAt\nbGludXgtMjQuMDQteDY0LnRhci5neiIsCiAgICAgICAgImFyY2giOiAieDY0\nIiwKICAgICAgICAicGxhdGZvcm0iOiAibGludXgiLAogICAgICAgICJwbGF0\nZm9ybV92ZXJzaW9uIjogIjI0LjA0IiwKICAgICAgICAiZG93bmxvYWRfdXJs\nIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12ZXJzaW9u\ncy9yZWxlYXNlcy9kb3dubG9hZC8zLjE0LjAtYWxwaGEuMC0xMDYxNjcyMDk1\nOC9weXRob24tMy4xNC4wLWFscGhhLjAtbGludXgtMjQuMDQteDY0LnRhci5n\neiIKICAgICAgfQogICAgXQogIH0sCiAgewogICAgInZlcnNpb24iOiAiMy4x\nMy4wLXJjLjIiLAogICAgInN0YWJsZSI6IGZhbHNlLAogICAgInJlbGVhc2Vf\ndXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12ZXJz\naW9ucy9yZWxlYXNlcy90YWcvMy4xMy4wLXJjLjItMTA3NjU3NDU4NTAiLAog\nICAgImZpbGVzIjogWwogICAgICB7CiAgICAgICAgImZpbGVuYW1lIjogInB5\ndGhvbi0zLjEzLjAtcmMuMi1kYXJ3aW4tYXJtNjQudGFyLmd6IiwKICAgICAg\nICAiYXJjaCI6ICJhcm02NCIsCiAgICAgICAgInBsYXRmb3JtIjogImRhcndp\nbiIsCiAgICAgICAgImRvd25sb2FkX3VybCI6ICJodHRwczovL2dpdGh1Yi5j\nb20vYWN0aW9ucy9weXRob24tdmVyc2lvbnMvcmVsZWFzZXMvZG93bmxvYWQv\nMy4xMy4wLXJjLjItMTA3NjU3NDU4NTAvcHl0aG9uLTMuMTMuMC1yYy4yLWRh\ncndpbi1hcm02NC50YXIuZ3oiCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAi\nZmlsZW5hbWUiOiAicHl0aG9uLTMuMTMuMC1yYy4yLWRhcndpbi14NjQudGFy\nLmd6IiwKICAgICAgICAiYXJjaCI6ICJ4NjQiLAogICAgICAgICJwbGF0Zm9y\nbSI6ICJkYXJ3aW4iLAogICAgICAgICJkb3dubG9hZF91cmwiOiAiaHR0cHM6\nLy9naXRodWIuY29tL2FjdGlvbnMvcHl0aG9uLXZlcnNpb25zL3JlbGVhc2Vz\nL2Rvd25sb2FkLzMuMTMuMC1yYy4yLTEwNzY1NzQ1ODUwL3B5dGhvbi0zLjEz\nLjAtcmMuMi1kYXJ3aW4teDY0LnRhci5neiIKICAgICAgfSwKICAgICAgewog\nICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy4xMy4wLXJjLjItbGludXgt\nMjAuMDQteDY0LnRhci5neiIsCiAgICAgICAgImFyY2giOiAieDY0IiwKICAg\nICAgICAicGxhdGZvcm0iOiAibGludXgiLAogICAgICAgICJwbGF0Zm9ybV92\nZXJzaW9uIjogIjIwLjA0IiwKICAgICAgICAiZG93bmxvYWRfdXJsIjogImh0\ndHBzOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxl\nYXNlcy9kb3dubG9hZC8zLjEzLjAtcmMuMi0xMDc2NTc0NTg1MC9weXRob24t\nMy4xMy4wLXJjLjItbGludXgtMjAuMDQteDY0LnRhci5neiIKICAgICAgfSwK\nICAgICAgewogICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy4xMy4wLXJj\nLjItbGludXgtMjIuMDQtYXJtNjQudGFyLmd6IiwKICAgICAgICAiYXJjaCI6\nICJhcm02NCIsCiAgICAgICAgInBsYXRmb3JtIjogImxpbnV4IiwKICAgICAg\nICAicGxhdGZvcm1fdmVyc2lvbiI6ICIyMi4wNCIsCiAgICAgICAgImRvd25s\nb2FkX3VybCI6ICJodHRwczovL2dpdGh1Yi5jb20vYWN0aW9ucy9weXRob24t\ndmVyc2lvbnMvcmVsZWFzZXMvZG93bmxvYWQvMy4xMy4wLXJjLjItMTA3NjU3\nNDU4NTAvcHl0aG9uLTMuMTMuMC1yYy4yLWxpbnV4LTIyLjA0LWFybTY0LnRh\nci5neiIKICAgICAgfSwKICAgICAgewogICAgICAgICJmaWxlbmFtZSI6ICJw\neXRob24tMy4xMy4wLXJjLjItbGludXgtMjIuMDQteDY0LnRhci5neiIsCiAg\nICAgICAgImFyY2giOiAieDY0IiwKICAgICAgICAicGxhdGZvcm0iOiAibGlu\ndXgiLAogICAgICAgICJwbGF0Zm9ybV92ZXJzaW9uIjogIjIyLjA0IiwKICAg\nICAgICAiZG93bmxvYWRfdXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rp\nb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxlYXNlcy9kb3dubG9hZC8zLjEzLjAt\ncmMuMi0xMDc2NTc0NTg1MC9weXRob24tMy4xMy4wLXJjLjItbGludXgtMjIu\nMDQteDY0LnRhci5neiIKICAgICAgfSwKICAgICAgewogICAgICAgICJmaWxl\nbmFtZSI6ICJweXRob24tMy4xMy4wLXJjLjItbGludXgtMjQuMDQtYXJtNjQu\ndGFyLmd6IiwKICAgICAgICAiYXJjaCI6ICJhcm02NCIsCiAgICAgICAgInBs\nYXRmb3JtIjogImxpbnV4IiwKICAgICAgICAicGxhdGZvcm1fdmVyc2lvbiI6\nICIyNC4wNCIsCiAgICAgICAgImRvd25sb2FkX3VybCI6ICJodHRwczovL2dp\ndGh1Yi5jb20vYWN0aW9ucy9weXRob24tdmVyc2lvbnMvcmVsZWFzZXMvZG93\nbmxvYWQvMy4xMy4wLXJjLjItMTA3NjU3NDU4NTAvcHl0aG9uLTMuMTMuMC1y\nYy4yLWxpbnV4LTI0LjA0LWFybTY0LnRhci5neiIKICAgICAgfSwKICAgICAg\newogICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy4xMy4wLXJjLjItbGlu\ndXgtMjQuMDQteDY0LnRhci5neiIsCiAgICAgICAgImFyY2giOiAieDY0IiwK\nICAgICAgICAicGxhdGZvcm0iOiAibGludXgiLAogICAgICAgICJwbGF0Zm9y\nbV92ZXJzaW9uIjogIjI0LjA0IiwKICAgICAgICAiZG93bmxvYWRfdXJsIjog\nImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12ZXJzaW9ucy9y\nZWxlYXNlcy9kb3dubG9hZC8zLjEzLjAtcmMuMi0xMDc2NTc0NTg1MC9weXRo\nb24tMy4xMy4wLXJjLjItbGludXgtMjQuMDQteDY0LnRhci5neiIKICAgICAg\nfSwKICAgICAgewogICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy4xMy4w\nLXJjLjItd2luMzItYXJtNjQuemlwIiwKICAgICAgICAiYXJjaCI6ICJhcm02\nNCIsCiAgICAgICAgInBsYXRmb3JtIjogIndpbjMyIiwKICAgICAgICAiZG93\nbmxvYWRfdXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhv\nbi12ZXJzaW9ucy9yZWxlYXNlcy9kb3dubG9hZC8zLjEzLjAtcmMuMi0xMDc2\nNTc0NTg1MC9weXRob24tMy4xMy4wLXJjLjItd2luMzItYXJtNjQuemlwIgog\nICAgICB9LAogICAgICB7CiAgICAgICAgImZpbGVuYW1lIjogInB5dGhvbi0z\nLjEzLjAtcmMuMi13aW4zMi14NjQuemlwIiwKICAgICAgICAiYXJjaCI6ICJ4\nNjQiLAogICAgICAgICJwbGF0Zm9ybSI6ICJ3aW4zMiIsCiAgICAgICAgImRv\nd25sb2FkX3VybCI6ICJodHRwczovL2dpdGh1Yi5jb20vYWN0aW9ucy9weXRo\nb24tdmVyc2lvbnMvcmVsZWFzZXMvZG93bmxvYWQvMy4xMy4wLXJjLjItMTA3\nNjU3NDU4NTAvcHl0aG9uLTMuMTMuMC1yYy4yLXdpbjMyLXg2NC56aXAiCiAg\nICAgIy9naXRodWIuY29tL2FjdGlvbnMvcHl0aG9uLXZlcnNpb25z\nL3JlbGVhc2VzL2Rvd25sb2FkLzMuNi44LTEwOTQ4Ny9weXRob24tMy42Ljgt\nd2luMzIteDg2LnppcCIKICAgICAgfQogICAgXQogIH0sCiAgewogICAgInZl\ncnNpb24iOiAiMy42LjciLAogICAgInN0YWJsZSI6IHRydWUsCiAgICAicmVs\nZWFzZV91cmwiOiAiaHR0cHM6Ly9naXRodWIuY29tL2FjdGlvbnMvcHl0aG9u\nLXZlcnNpb25zL3JlbGVhc2VzL3RhZy8zLjYuNy05NjkwNCIsCiAgICAiZmls\nZXMiOiBbCiAgICAgIHsKICAgICAgICAiZmlsZW5hbWUiOiAicHl0aG9uLTMu\nNi43LWRhcndpbi14NjQudGFyLmd6IiwKICAgICAgICAiYXJjaCI6ICJ4NjQi\nLAogICAgICAgICJwbGF0Zm9ybSI6ICJkYXJ3aW4iLAogICAgICAgICJkb3du\nbG9hZF91cmwiOiAiaHR0cHM6Ly9naXRodWIuY29tL2FjdGlvbnMvcHl0aG9u\nLXZlcnNpb25zL3JlbGVhc2VzL2Rvd25sb2FkLzMuNi43LTk2OTA0L3B5dGhv\nbi0zLjYuNy1kYXJ3aW4teDY0LnRhci5neiIKICAgICAgfSwKICAgICAgewog\nICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy42LjctbGludXgtMTYuMDQt\neDY0LnRhci5neiIsCiAgICAgICAgImFyY2giOiAieDY0IiwKICAgICAgICAi\ncGxhdGZvcm0iOiAibGludXgiLAogICAgICAgICJwbGF0Zm9ybV92ZXJzaW9u\nIjogIjE2LjA0IiwKICAgICAgICAiZG93bmxvYWRfdXJsIjogImh0dHBzOi8v\nZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxlYXNlcy9k\nb3dubG9hZC8zLjYuNy05NjkwNC9weXRob24tMy42LjctbGludXgtMTYuMDQt\neDY0LnRhci5neiIKICAgICAgfSwKICAgICAgewogICAgICAgICJmaWxlbmFt\nZSI6ICJweXRob24tMy42LjctbGludXgtMTguMDQteDY0LnRhci5neiIsCiAg\nICAgICAgImFyY2giOiAieDY0IiwKICAgICAgICAicGxhdGZvcm0iOiAibGlu\ndXgiLAogICAgICAgICJwbGF0Zm9ybV92ZXJzaW9uIjogIjE4LjA0IiwKICAg\nICAgICAiZG93bmxvYWRfdXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rp\nb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxlYXNlcy9kb3dubG9hZC8zLjYuNy05\nNjkwNC9weXRob24tMy42LjctbGludXgtMTguMDQteDY0LnRhci5neiIKICAg\nICAgfSwKICAgICAgewogICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy42\nLjctbGludXgtMjAuMDQteDY0LnRhci5neiIsCiAgICAgICAgImFyY2giOiAi\neDY0IiwKICAgICAgICAicGxhdGZvcm0iOiAibGludXgiLAogICAgICAgICJw\nbGF0Zm9ybV92ZXJzaW9uIjogIjIwLjA0IiwKICAgICAgICAiZG93bmxvYWRf\ndXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12ZXJz\naW9ucy9yZWxlYXNlcy9kb3dubG9hZC8zLjYuNy05NjkwNC9weXRob24tMy42\nLjctbGludXgtMjAuMDQteDY0LnRhci5neiIKICAgICAgfSwKICAgICAgewog\nICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy42Ljctd2luMzIteDY0Lnpp\ncCIsCiAgICAgICAgImFyY2giOiAieDY0IiwKICAgICAgICAicGxhdGZvcm0i\nOiAid2luMzIiLAogICAgICAgICJkb3dubG9hZF91cmwiOiAiaHR0cHM6Ly9n\naXRodWIuY29tL2FjdGlvbnMvcHl0aG9uLXZlcnNpb25zL3JlbGVhc2VzL2Rv\nd25sb2FkLzMuNi43LTk2OTA0L3B5dGhvbi0zLjYuNy13aW4zMi14NjQuemlw\nIgogICAgICB9LAogICAgICB7CiAgICAgICAgImZpbGVuYW1lIjogInB5dGhv\nbi0zLjYuNy13aW4zMi14ODYuemlwIiwKICAgICAgICAiYXJjaCI6ICJ4ODYi\nLAogICAgICAgICJwbGF0Zm9ybSI6ICJ3aW4zMiIsCiAgICAgICAgImRvd25s\nb2FkX3VybCI6ICJodHRwczovL2dpdGh1Yi5jb20vYWN0aW9ucy9weXRob24t\ndmVyc2lvbnMvcmVsZWFzZXMvZG93bmxvYWQvMy42LjctOTY5MDQvcHl0aG9u\nLTMuNi43LXdpbjMyLXg4Ni56aXAiCiAgICAgIH0KICAgIF0KICB9LAogIHsK\nICAgICJ2ZXJzaW9uIjogIjMuNS4xMCIsCiAgICAic3RhYmxlIjogdHJ1ZSwK\nICAgICJyZWxlYXNlX3VybCI6ICJodHRwczovL2dpdGh1Yi5jb20vYWN0aW9u\ncy9weXRob24tdmVyc2lvbnMvcmVsZWFzZXMvdGFnLzMuNS4xMC05MDAyNiIs\nCiAgICAiZmlsZXMiOiBbCiAgICAgIHsKICAgICAgICAiZmlsZW5hbWUiOiAi\ncHl0aG9uLTMuNS4xMC1kYXJ3aW4teDY0LnRhci5neiIsCiAgICAgICAgImFy\nY2giOiAieDY0IiwKICAgICAgICAicGxhdGZvcm0iOiAiZGFyd2luIiwKICAg\nICAgICAiZG93bmxvYWRfdXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rp\nb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxlYXNlcy9kb3dubG9hZC8zLjUuMTAt\nOTAwMjYvcHl0aG9uLTMuNS4xMC1kYXJ3aW4teDY0LnRhci5neiIKICAgICAg\nfSwKICAgICAgewogICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy41LjEw\nLWxpbnV4LTE2LjA0LXg2NC50YXIuZ3oiLAogICAgICAgICJhcmNoIjogIng2\nNCIsCiAgICAgICAgInBsYXRmb3JtIjogImxpbnV4IiwKICAgICAgICAicGxh\ndGZvcm1fdmVyc2lvbiI6ICIxNi4wNCIsCiAgICAgICAgImRvd25sb2FkX3Vy\nbCI6ICJodHRwczovL2dpdGh1Yi5jb20vYWN0aW9ucy9weXRob24tdmVyc2lv\nbnMvcmVsZWFzZXMvZG93bmxvYWQvMy41LjEwLTkwMDI2L3B5dGhvbi0zLjUu\nMTAtbGludXgtMTYuMDQteDY0LnRhci5neiIKICAgICAgfSwKICAgICAgewog\nICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy41LjEwLWxpbnV4LTE4LjA0\nLXg2NC50YXIuZ3oiLAogICAgICAgICJhcmNoIjogIng2NCIsCiAgICAgICAg\nInBsYXRmb3JtIjogImxpbnV4IiwKICAgICAgICAicGxhdGZvcm1fdmVyc2lv\nbiI6ICIxOC4wNCIsCiAgICAgICAgImRvd25sb2FkX3VybCI6ICJodHRwczov\nL2dpdGh1Yi5jb20vYWN0aW9ucy9weXRob24tdmVyc2lvbnMvcmVsZWFzZXMv\nZG93bmxvYWQvMy41LjEwLTkwMDI2L3B5dGhvbi0zLjUuMTAtbGludXgtMTgu\nMDQteDY0LnRhci5neiIKICAgICAgfSwKICAgICAgewogICAgICAgICJmaWxl\nbmFtZSI6ICJweXRob24tMy41LjEwLWxpbnV4LTIwLjA0LXg2NC50YXIuZ3oi\nLAogICAgICAgICJhcmNoIjogIng2NCIsCiAgICAgICAgInBsYXRmb3JtIjog\nImxpbnV4IiwKICAgICAgICAicGxhdGZvcm1fdmVyc2lvbiI6ICIyMC4wNCIs\nCiAgICAgICAgImRvd25sb2FkX3VybCI6ICJodHRwczovL2dpdGh1Yi5jb20v\nYWN0aW9ucy9weXRob24tdmVyc2lvbnMvcmVsZWFzZXMvZG93bmxvYWQvMy41\nLjEwLTkwMDI2L3B5dGhvbi0zLjUuMTAtbGludXgtMjAuMDQteDY0LnRhci5n\neiIKICAgICAgfQogICAgXQogIH0sCiAgewogICAgInZlcnNpb24iOiAiMy41\nLjkiLAogICAgInN0YWJsZSI6IHRydWUsCiAgICAicmVsZWFzZV91cmwiOiAi\naHR0cHM6Ly9naXRodWIuY29tL2FjdGlvbnMvcHl0aG9uLXZlcnNpb25zL3Jl\nbGVhc2VzL3RhZy8zLjUuOS05MDE4MSIsCiAgICAiZmlsZXMiOiBbCiAgICAg\nIHsKICAgICAgICAiZmlsZW5hbWUiOiAicHl0aG9uLTMuNS45LWRhcndpbi14\nNjQudGFyLmd6IiwKICAgICAgICAiYXJjaCI6ICJ4NjQiLAogICAgICAgICJw\nbGF0Zm9ybSI6ICJkYXJ3aW4iLAogICAgICAgICJkb3dubG9hZF91cmwiOiAi\naHR0cHM6Ly9naXRodWIuY29tL2FjdGlvbnMvcHl0aG9uLXZlcnNpb25zL3Jl\nbGVhc2VzL2Rvd25sb2FkLzMuNS45LTkwMTgxL3B5dGhvbi0zLjUuOS1kYXJ3\naW4teDY0LnRhci5neiIKICAgICAgfSwKICAgICAgewogICAgICAgICJmaWxl\nbmFtZSI6ICJweXRob24tMy41LjktbGludXgtMTYuMDQteDY0LnRhci5neiIs\nCiAgICAgICAgImFyY2giOiAieDY0IiwKICAgICAgICAicGxhdGZvcm0iOiAi\nbGludXgiLAogICAgICAgICJwbGF0Zm9ybV92ZXJzaW9uIjogIjE2LjA0IiwK\nICAgICAgICAiZG93bmxvYWRfdXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9h\nY3Rpb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxlYXNlcy9kb3dubG9hZC8zLjUu\nOS05MDE4MS9weXRob24tMy41LjktbGludXgtMTYuMDQteDY0LnRhci5neiIK\nICAgICAgfSwKICAgICAgewogICAgICAgICJmaWxlbmFtZSI6ICJweXRob24t\nMy41LjktbGludXgtMTguMDQteDY0LnRhci5neiIsCiAgICAgICAgImFyY2gi\nOiAieDY0IiwKICAgICAgICAicGxhdGZvcm0iOiAibGludXgiLAogICAgICAg\nICJwbGF0Zm9ybV92ZXJzaW9uIjogIjE4LjA0IiwKICAgICAgICAiZG93bmxv\nYWRfdXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12\nZXJzaW9ucy9yZWxlYXNlcy9kb3dubG9hZC8zLjUuOS05MDE4MS9weXRob24t\nMy41LjktbGludXgtMTguMDQteDY0LnRhci5neiIKICAgICAgfSwKICAgICAg\newogICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy41LjktbGludXgtMjAu\nMDQteDY0LnRhci5neiIsCiAgICAgICAgImFyY2giOiAieDY0IiwKICAgICAg\nICAicGxhdGZvcm0iOiAibGludXgiLAogICAgICAgICJwbGF0Zm9ybV92ZXJz\naW9uIjogIjIwLjA0IiwKICAgICAgICAiZG93bmxvYWRfdXJsIjogImh0dHBz\nOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxlYXNl\ncy9kb3dubG9hZC8zLjUuOS05MDE4MS9weXRob24tMy41LjktbGludXgtMjAu\nMDQteDY0LnRhci5neiIKICAgICAgfQogICAgXQogIH0sCiAgewogICAgInZl\ncnNpb24iOiAiMy41LjQiLAogICAgInN0YWJsZSI6IHRydWUsCiAgICAicmVs\nZWFzZV91cmwiOiAiaHR0cHM6Ly9naXRodWIuY29tL2FjdGlvbnMvcHl0aG9u\nLXZlcnNpb25zL3JlbGVhc2VzL3RhZy8zLjUuNC05NzE3NSIsCiAgICAiZmls\nZXMiOiBbCiAgICAgIHsKICAgICAgICAiZmlsZW5hbWUiOiAicHl0aG9uLTMu\nNS40LWRhcndpbi14NjQudGFyLmd6IiwKICAgICAgICAiYXJjaCI6ICJ4NjQi\nLAogICAgICAgICJwbGF0Zm9ybSI6ICJkYXJ3aW4iLAogICAgICAgICJkb3du\nbG9hZF91cmwiOiAiaHR0cHM6Ly9naXRodWIuY29tL2FjdGlvbnMvcHl0aG9u\nLXZlcnNpb25zL3JlbGVhc2VzL2Rvd25sb2FkLzMuNS40LTk3MTc1L3B5dGhv\nbi0zLjUuNC1kYXJ3aW4teDY0LnRhci5neiIKICAgICAgfSwKICAgICAgewog\nICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy41LjQtbGludXgtMTYuMDQt\neDY0LnRhci5neiIsCiAgICAgICAgImFyY2giOiAieDY0IiwKICAgICAgICAi\ncGxhdGZvcm0iOiAibGludXgiLAogICAgICAgICJwbGF0Zm9ybV92ZXJzaW9u\nIjogIjE2LjA0IiwKICAgICAgICAiZG93bmxvYWRfdXJsIjogImh0dHBzOi8v\nZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxlYXNlcy9k\nb3dubG9hZC8zLjUuNC05NzE3NS9weXRob24tMy41LjQtbGludXgtMTYuMDQt\neDY0LnRhci5neiIKICAgICAgfSwKICAgICAgewogICAgICAgICJmaWxlbmFt\nZSI6ICJweXRob24tMy41LjQtbGludXgtMTguMDQteDY0LnRhci5neiIsCiAg\nICAgICAgImFyY2giOiAieDY0IiwKICAgICAgICAicGxhdGZvcm0iOiAibGlu\ndXgiLAogICAgICAgICJwbGF0Zm9ybV92ZXJzaW9uIjogIjE4LjA0IiwKICAg\nICAgICAiZG93bmxvYWRfdXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rp\nb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxlYXNlcy9kb3dubG9hZC8zLjUuNC05\nNzE3NS9weXRob24tMy41LjQtbGludXgtMTguMDQteDY0LnRhci5neiIKICAg\nICAgfSwKICAgICAgewogICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy41\nLjQtbGludXgtMjAuMDQteDY0LnRhci5neiIsCiAgICAgICAgImFyY2giOiAi\neDY0IiwKICAgICAgICAicGxhdGZvcm0iOiAibGludXgiLAogICAgICAgICJw\nbGF0Zm9ybV92ZXJzaW9uIjogIjIwLjA0IiwKICAgICAgICAiZG93bmxvYWRf\ndXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12ZXJz\naW9ucy9yZWxlYXNlcy9kb3dubG9hZC8zLjUuNC05NzE3NS9weXRob24tMy41\nLjQtbGludXgtMjAuMDQteDY0LnRhci5neiIKICAgICAgfSwKICAgICAgewog\nICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy41LjQtd2luMzIteDY0Lnpp\ncCIsCiAgICAgICAgImFyY2giOiAieDY0IiwKICAgICAgICAicGxhdGZvcm0i\nOiAid2luMzIiLAogICAgICAgICJkb3dubG9hZF91cmwiOiAiaHR0cHM6Ly9n\naXRodWIuY29tL2FjdGlvbnMvcHl0aG9uLXZlcnNpb25zL3JlbGVhc2VzL2Rv\nd25sb2FkLzMuNS40LTk3MTc1L3B5dGhvbi0zLjUuNC13aW4zMi14NjQuemlw\nIgogICAgICB9LAogICAgICB7CiAgICAgICAgImZpbGVuYW1lIjogInB5dGhv\nbi0zLjUuNC13aW4zMi14ODYuemlwIiwKICAgICAgICAiYXJjaCI6ICJ4ODYi\nLAogICAgICAgICJwbGF0Zm9ybSI6ICJ3aW4zMiIsCiAgICAgICAgImRvd25s\nb2FkX3VybCI6ICJodHRwczovL2dpdGh1Yi5jb20vYWN0aW9ucy9weXRob24t\ndmVyc2lvbnMvcmVsZWFzZXMvZG93bmxvYWQvMy41LjQtOTcxNzUvcHl0aG9u\nLTMuNS40LXdpbjMyLXg4Ni56aXAiCiAgICAgIH0KICAgIF0KICB9LAogIHsK\nICAgICJ2ZXJzaW9uIjogIjMuNC4xMCIsCiAgICAic3RhYmxlIjogdHJ1ZSwK\nICAgICJyZWxlYXNlX3VybCI6ICJodHRwczovL2dpdGh1Yi5jb20vYWN0aW9u\ncy9weXRob24tdmVyc2lvbnMvcmVsZWFzZXMvdGFnLzMuNC4xMCIsCiAgICAi\nZmlsZXMiOiBbCiAgICAgIHsKICAgICAgICAiZmlsZW5hbWUiOiAicHl0aG9u\nLTMuNC4xMC1saW51eC0xOC4wNC14NjQudGFyLmd6IiwKICAgICAgICAiYXJj\naCI6ICJ4NjQiLAogICAgICAgICJwbGF0Zm9ybSI6ICJsaW51eCIsCiAgICAg\nICAgInBsYXRmb3JtX3ZlcnNpb24iOiAiMTguMDQiLAogICAgICAgICJkb3du\nbG9hZF91cmwiOiAiaHR0cHM6Ly9naXRodWIuY29tL2FjdGlvbnMvcHl0aG9u\nLXZlcnNpb25zL3JlbGVhc2VzL2Rvd25sb2FkLzMuNC4xMC9weXRob24tMy40\nLjEwLWxpbnV4LTE4LjA0LXg2NC50YXIuZ3oiCiAgICAgIH0KICAgIF0KICB9\nLAogIHsKICAgICJ2ZXJzaW9uIjogIjMuNC40IiwKICAgICJzdGFibGUiOiB0\ncnVlLAogICAgInJlbGVhc2VfdXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9h\nY3Rpb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxlYXNlcy90YWcvMy40LjQtODgw\nOTgiLAogICAgImZpbGVzIjogWwogICAgICB7CiAgICAgICAgImZpbGVuYW1l\nIjogInB5dGhvbi0zLjQuNC13aW4zMi14NjQuemlwIiwKICAgICAgICAiYXJj\naCI6ICJ4NjQiLAogICAgICAgICJwbGF0Zm9ybSI6ICJ3aW4zMiIsCiAgICAg\nICAgImRvd25sb2FkX3VybCI6ICJodHRwczovL2dpdGh1Yi5jb20vYWN0aW9u\ncy9weXRob24tdmVyc2lvbnMvcmVsZWFzZXMvZG93bmxvYWQvMy40LjQtODgw\nOTgvcHl0aG9uLTMuNC40LXdpbjMyLXg2NC56aXAiCiAgICAgIH0sCiAgICAg\nIHsKICAgICAgICAiZmlsZW5hbWUiOiAicHl0aG9uLTMuNC40LXdpbjMyLXg4\nNi56aXAiLAogICAgICAgICJhcmNoIjogIng4NiIsCiAgICAgICAgInBsYXRm\nb3JtIjogIndpbjMyIiwKICAgICAgICAiZG93bmxvYWRfdXJsIjogImh0dHBz\nOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxlYXNl\ncy9kb3dubG9hZC8zLjQuNC04ODA5OC9weXRob24tMy40LjQtd2luMzIteDg2\nLnppcCIKICAgICAgfQogICAgXQogIH0sCiAgewogICAgInZlcnNpb24iOiAi\nMy4zLjciLAogICAgInN0YWJsZSI6IHRydWUsCiAgICAicmVsZWFzZV91cmwi\nOiAiaHR0cHM6Ly9naXRodWIuY29tL2FjdGlvbnMvcHl0aG9uLXZlcnNpb25z\nL3JlbGVhc2VzL3RhZy8zLjMuNyIsCiAgICAiZmlsZXMiOiBbCiAgICAgIHsK\nICAgICAgICAiZmlsZW5hbWUiOiAicHl0aG9uLTMuMy43LWxpbnV4LTE4LjA0\nLXg2NC50YXIuZ3oiLAogICAgICAgICJhcmNoIjogIng2NCIsCiAgICAgICAg\nInBsYXRmb3JtIjogImxpbnV4IiwKICAgICAgICAicGxhdGZvcm1fdmVyc2lv\nbiI6ICIxOC4wNCIsCiAgICAgICAgImRvd25sb2FkX3VybCI6ICJodHRwczov\nL2dpdGh1Yi5jb20vYWN0aW9ucy9weXRob24tdmVyc2lvbnMvcmVsZWFzZXMv\nZG93bmxvYWQvMy4zLjcvcHl0aG9uLTMuMy43LWxpbnV4LTE4LjA0LXg2NC50\nYXIuZ3oiCiAgICAgIH0KICAgIF0KICB9LAogIHsKICAgICJ2ZXJzaW9uIjog\nIjMuMy41IiwKICAgICJzdGFibGUiOiB0cnVlLAogICAgInJlbGVhc2VfdXJs\nIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12ZXJzaW9u\ncy9yZWxlYXNlcy90YWcvMy4zLjUtODgxMDQiLAogICAgImZpbGVzIjogWwog\nICAgICB7CiAgICAgICAgImZpbGVuYW1lIjogInB5dGhvbi0zLjMuNS13aW4z\nMi14NjQuemlwIiwKICAgICAgICAiYXJjaCI6ICJ4NjQiLAogICAgICAgICJw\nbGF0Zm9ybSI6ICJ3aW4zMiIsCiAgICAgICAgImRvd25sb2FkX3VybCI6ICJo\ndHRwczovL2dpdGh1Yi5jb20vYWN0aW9ucy9weXRob24tdmVyc2lvbnMvcmVs\nZWFzZXMvZG93bmxvYWQvMy4zLjUtODgxMDQvcHl0aG9uLTMuMy41LXdpbjMy\nLXg2NC56aXAiCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAiZmlsZW5hbWUi\nOiAicHl0aG9uLTMuMy41LXdpbjMyLXg4Ni56aXAiLAogICAgICAgICJhcmNo\nIjogIng4NiIsCiAgICAgICAgInBsYXRmb3JtIjogIndpbjMyIiwKICAgICAg\nICAiZG93bmxvYWRfdXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rpb25z\nL3B5dGhvbi12ZXJzaW9ucy9yZWxlYXNlcy9kb3dubG9hZC8zLjMuNS04ODEw\nNC9weXRob24tMy4zLjUtd2luMzIteDg2LnppcCIKICAgICAgfQogICAgXQog\nIH0sCiAgewogICAgInZlcnNpb24iOiAiMy4yLjUiLAogICAgInN0YWJsZSI6\nIHRydWUsCiAgICAicmVsZWFzZV91cmwiOiAiaHR0cHM6Ly9naXRodWIuY29t\nL2FjdGlvbnMvcHl0aG9uLXZlcnNpb25zL3JlbGVhc2VzL3RhZy8zLjIuNS04\nODEwNSIsCiAgICAiZmlsZXMiOiBbCiAgICAgIHsKICAgICAgICAiZmlsZW5h\nbWUiOiAicHl0aG9uLTMuMi41LXdpbjMyLXg2NC56aXAiLAogICAgICAgICJh\ncmNoIjogIng2NCIsCiAgICAgICAgInBsYXRmb3JtIjogIndpbjMyIiwKICAg\nICAgICAiZG93bmxvYWRfdXJsIjogImh0dHBzOi8vZ2l0aHViLmNvbS9hY3Rp\nb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxlYXNlcy9kb3dubG9hZC8zLjIuNS04\nODEwNS9weXRob24tMy4yLjUtd2luMzIteDY0LnppcCIKICAgICAgfSwKICAg\nICAgewogICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy4yLjUtd2luMzIt\neDg2LnppcCIsCiAgICAgICAgImFyY2giOiAieDg2IiwKICAgICAgICAicGxh\ndGZvcm0iOiAid2luMzIiLAogICAgICAgICJkb3dubG9hZF91cmwiOiAiaHR0\ncHM6Ly9naXRodWIuY29tL2FjdGlvbnMvcHl0aG9uLXZlcnNpb25zL3JlbGVh\nc2VzL2Rvd25sb2FkLzMuMi41LTg4MTA1L3B5dGhvbi0zLjIuNS13aW4zMi14\nODYuemlwIgogICAgICB9CiAgICBdCiAgfSwKICB7CiAgICAidmVyc2lvbiI6\nICIzLjEuNCIsCiAgICAic3RhYmxlIjogdHJ1ZSwKICAgICJyZWxlYXNlX3Vy\nbCI6ICJodHRwczovL2dpdGh1Yi5jb20vYWN0aW9ucy9weXRob24tdmVyc2lv\nbnMvcmVsZWFzZXMvdGFnLzMuMS40LTg4MTA2IiwKICAgICJmaWxlcyI6IFsK\nICAgICAgewogICAgICAgICJmaWxlbmFtZSI6ICJweXRob24tMy4xLjQtd2lu\nMzIteDY0LnppcCIsCiAgICAgICAgImFyY2giOiAieDY0IiwKICAgICAgICAi\ncGxhdGZvcm0iOiAid2luMzIiLAogICAgICAgICJkb3dubG9hZF91cmwiOiAi\naHR0cHM6Ly9naXRodWIuY29tL2FjdGlvbnMvcHl0aG9uLXZlcnNpb25zL3Jl\nbGVhc2VzL2Rvd25sb2FkLzMuMS40LTg4MTA2L3B5dGhvbi0zLjEuNC13aW4z\nMi14NjQuemlwIgogICAgICB9LAogICAgICB7CiAgICAgICAgImZpbGVuYW1l\nIjogInB5dGhvbi0zLjEuNC13aW4zMi14ODYuemlwIiwKICAgICAgICAiYXJj\naCI6ICJ4ODYiLAogICAgICAgICJwbGF0Zm9ybSI6ICJ3aW4zMiIsCiAgICAg\nICAgImRvd25sb2FkX3VybCI6ICJodHRwczovL2dpdGh1Yi5jb20vYWN0aW9u\ncy9weXRob24tdmVyc2lvbnMvcmVsZWFzZXMvZG93bmxvYWQvMy4xLjQtODgx\nMDYvcHl0aG9uLTMuMS40LXdpbjMyLXg4Ni56aXAiCiAgICAgIH0KICAgIF0K\nICB9LAogIHsKICAgICJ2ZXJzaW9uIjogIjMuMC4xIiwKICAgICJzdGFibGUi\nOiB0cnVlLAogICAgInJlbGVhc2VfdXJsIjogImh0dHBzOi8vZ2l0aHViLmNv\nbS9hY3Rpb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxlYXNlcy90YWcvMy4wLjEt\nODgxMDciLAogICAgImZpbGVzIjogWwogICAgICB7CiAgICAgICAgImZpbGVu\nYW1lIjogInB5dGhvbi0zLjAuMS13aW4zMi14NjQuemlwIiwKICAgICAgICAi\nYXJjaCI6ICJ4NjQiLAogICAgICAgICJwbGF0Zm9ybSI6ICJ3aW4zMiIsCiAg\nICAgICAgImRvd25sb2FkX3VybCI6ICJodHRwczovL2dpdGh1Yi5jb20vYWN0\naW9ucy9weXRob24tdmVyc2lvbnMvcmVsZWFzZXMvZG93bmxvYWQvMy4wLjEt\nODgxMDcvcHl0aG9uLTMuMC4xLXdpbjMyLXg2NC56aXAiCiAgICAgIH0sCiAg\nICAgIHsKICAgICAgICAiZmlsZW5hbWUiOiAicHl0aG9uLTMuMC4xLXdpbjMy\nLXg4Ni56aXAiLAogICAgICAgICJhcmNoIjogIng4NiIsCiAgICAgICAgInBs\nYXRmb3JtIjogIndpbjMyIiwKICAgICAgICAiZG93bmxvYWRfdXJsIjogImh0\ndHBzOi8vZ2l0aHViLmNvbS9hY3Rpb25zL3B5dGhvbi12ZXJzaW9ucy9yZWxl\nYXNlcy9kb3dubG9hZC8zLjAuMS04ODEwNy9weXRob24tMy4wLjEtd2luMzIt\neDg2LnppcCIKICAgICAgfQogICAgXQogIH0KXQo=\n',
    //   encoding: 'base64'
    // };
    const repoManifest= [{
      "version": "3.13.1",
      "stable": true,
      "release_url": "https://github.com/actions/python-versions/releases/tag/3.13.1-13437882550",
      "files": [
        {
          "filename": "python-3.13.1-darwin-arm64-freethreaded.tar.gz",
          "arch": "arm64-freethreaded",
          "platform": "darwin",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-darwin-arm64-freethreaded.tar.gz"
        },
        {
          "filename": "python-3.13.1-darwin-arm64.tar.gz",
          "arch": "arm64",
          "platform": "darwin",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-darwin-arm64.tar.gz"
        },
        {
          "filename": "python-3.13.1-darwin-x64-freethreaded.tar.gz",
          "arch": "x64-freethreaded",
          "platform": "darwin",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-darwin-x64-freethreaded.tar.gz"
        },
        {
          "filename": "python-3.13.1-darwin-x64.tar.gz",
          "arch": "x64",
          "platform": "darwin",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-darwin-x64.tar.gz"
        },
        {
          "filename": "python-3.13.1-linux-20.04-x64-freethreaded.tar.gz",
          "arch": "x64-freethreaded",
          "platform": "linux",
          "platform_version": "20.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-linux-20.04-x64-freethreaded.tar.gz"
        },
        {
          "filename": "python-3.13.1-linux-20.04-x64.tar.gz",
          "arch": "x64",
          "platform": "linux",
          "platform_version": "20.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-linux-20.04-x64.tar.gz"
        },
        {
          "filename": "python-3.13.1-linux-22.04-arm64-freethreaded.tar.gz",
          "arch": "arm64-freethreaded",
          "platform": "linux",
          "platform_version": "22.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-linux-22.04-arm64-freethreaded.tar.gz"
        },
        {
          "filename": "python-3.13.1-linux-22.04-arm64.tar.gz",
          "arch": "arm64",
          "platform": "linux",
          "platform_version": "22.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-linux-22.04-arm64.tar.gz"
        },
        {
          "filename": "python-3.13.1-linux-22.04-x64-freethreaded.tar.gz",
          "arch": "x64-freethreaded",
          "platform": "linux",
          "platform_version": "22.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-linux-22.04-x64-freethreaded.tar.gz"
        },
        {
          "filename": "python-3.13.1-linux-22.04-x64.tar.gz",
          "arch": "x64",
          "platform": "linux",
          "platform_version": "22.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-linux-22.04-x64.tar.gz"
        },
        {
          "filename": "python-3.13.1-linux-24.04-arm64-freethreaded.tar.gz",
          "arch": "arm64-freethreaded",
          "platform": "linux",
          "platform_version": "24.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-linux-24.04-arm64-freethreaded.tar.gz"
        },
        {
          "filename": "python-3.13.1-linux-24.04-arm64.tar.gz",
          "arch": "arm64",
          "platform": "linux",
          "platform_version": "24.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-linux-24.04-arm64.tar.gz"
        },
        {
          "filename": "python-3.13.1-linux-24.04-x64-freethreaded.tar.gz",
          "arch": "x64-freethreaded",
          "platform": "linux",
          "platform_version": "24.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-linux-24.04-x64-freethreaded.tar.gz"
        },
        {
          "filename": "python-3.13.1-linux-24.04-x64.tar.gz",
          "arch": "x64",
          "platform": "linux",
          "platform_version": "24.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-linux-24.04-x64.tar.gz"
        },
        {
          "filename": "python-3.13.1-win32-arm64-freethreaded.zip",
          "arch": "arm64-freethreaded",
          "platform": "win32",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-win32-arm64-freethreaded.zip"
        },
        {
          "filename": "python-3.13.1-win32-arm64.zip",
          "arch": "arm64",
          "platform": "win32",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-win32-arm64.zip"
        },
        {
          "filename": "python-3.13.1-win32-x64-freethreaded.zip",
          "arch": "x64-freethreaded",
          "platform": "win32",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-win32-x64-freethreaded.zip"
        },
        {
          "filename": "python-3.13.1-win32-x64.zip",
          "arch": "x64",
          "platform": "win32",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-win32-x64.zip"
        },
        {
          "filename": "python-3.13.1-win32-x86-freethreaded.zip",
          "arch": "x86-freethreaded",
          "platform": "win32",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-win32-x86-freethreaded.zip"
        },
        {
          "filename": "python-3.13.1-win32-x86.zip",
          "arch": "x86",
          "platform": "win32",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.1-13437882550/python-3.13.1-win32-x86.zip"
        }
      ]
    },
    {
      "version": "3.13.0",
      "stable": true,
      "release_url": "https://github.com/actions/python-versions/releases/tag/3.13.0-11228081754",
      "files": [
        {
          "filename": "python-3.13.0-darwin-arm64.tar.gz",
          "arch": "arm64",
          "platform": "darwin",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.0-11228081754/python-3.13.0-darwin-arm64.tar.gz"
        },
        {
          "filename": "python-3.13.0-darwin-x64.tar.gz",
          "arch": "x64",
          "platform": "darwin",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.0-11228081754/python-3.13.0-darwin-x64.tar.gz"
        },
        {
          "filename": "python-3.13.0-linux-20.04-x64.tar.gz",
          "arch": "x64",
          "platform": "linux",
          "platform_version": "20.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.0-11228081754/python-3.13.0-linux-20.04-x64.tar.gz"
        },
        {
          "filename": "python-3.13.0-linux-22.04-arm64.tar.gz",
          "arch": "arm64",
          "platform": "linux",
          "platform_version": "22.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.0-11228081754/python-3.13.0-linux-22.04-arm64.tar.gz"
        },
        {
          "filename": "python-3.13.0-linux-22.04-x64.tar.gz",
          "arch": "x64",
          "platform": "linux",
          "platform_version": "22.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.0-11228081754/python-3.13.0-linux-22.04-x64.tar.gz"
        },
        {
          "filename": "python-3.13.0-linux-24.04-arm64.tar.gz",
          "arch": "arm64",
          "platform": "linux",
          "platform_version": "24.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.0-11228081754/python-3.13.0-linux-24.04-arm64.tar.gz"
        },
        {
          "filename": "python-3.13.0-linux-24.04-x64.tar.gz",
          "arch": "x64",
          "platform": "linux",
          "platform_version": "24.04",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.0-11228081754/python-3.13.0-linux-24.04-x64.tar.gz"
        },
        {
          "filename": "python-3.13.0-win32-arm64.zip",
          "arch": "arm64",
          "platform": "win32",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.0-11228081754/python-3.13.0-win32-arm64.zip"
        },
        {
          "filename": "python-3.13.0-win32-x64.zip",
          "arch": "x64",
          "platform": "win32",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.0-11228081754/python-3.13.0-win32-x64.zip"
        },
        {
          "filename": "python-3.13.0-win32-x86.zip",
          "arch": "x86",
          "platform": "win32",
          "download_url": "https://github.com/actions/python-versions/releases/download/3.13.0-11228081754/python-3.13.0-win32-x86.zip"
        }
      ]
    }]
    core.debug('repomanifest'+repoManifest.toString());
    if (
      Array.isArray(repoManifest) &&
      repoManifest.length &&
      repoManifest.every(isIToolRelease)
    ) {
      return repoManifest;
    }
  } catch (err) {
    core.debug('Fetching the manifest via the API failed.');
    if (err instanceof Error) {
      core.debug(err.message);
    }
  }
  core.debug('Falling back to fetching the manifest using raw URL. after failing from repomanifest');
  return await getManifestFromURL();
}

export function getManifestFromRepo(): Promise<tc.IToolRelease[]> {
  core.debug(
    `Getting manifest from ${MANIFEST_REPO_OWNER}/${MANIFEST_REPO_NAME}@${MANIFEST_REPO_BRANCH}`
  );
  return tc.getManifestFromRepo(
    MANIFEST_REPO_OWNER,
    MANIFEST_REPO_NAME,
    AUTH,
    MANIFEST_REPO_BRANCH
  );
}

export async function getManifestFromURL(): Promise<tc.IToolRelease[]> {
  core.debug('Falling back to fetching the manifest using raw URL.');
  core.debug('It is the main way to get the manifest');
  const http: httpm.HttpClient = new httpm.HttpClient('tool-cache');
  const response = await http.getJson<tc.IToolRelease[]>(MANIFEST_URL);
  if (!response.result) {
    throw new Error(`Unable to get manifest from ${MANIFEST_URL}`);
  }
  return response.result;
}

async function installPython(workingDirectory: string) {
  const options: ExecOptions = {
    cwd: workingDirectory,
    env: {
      ...process.env,
      ...(IS_LINUX && {LD_LIBRARY_PATH: path.join(workingDirectory, 'lib')})
    },
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        core.info(data.toString().trim());
      },
      stderr: (data: Buffer) => {
        core.error(data.toString().trim());
      }
    }
  };

  if (IS_WINDOWS) {
    await exec.exec('powershell', ['./setup.ps1'], options);
  } else {
    await exec.exec('bash', ['./setup.sh'], options);
  }
}

export async function installCpythonFromRelease(release: tc.IToolRelease) {
  const downloadUrl = release.files[0].download_url;

  core.info(`Download from "${downloadUrl}"`);
  let pythonPath = '';
  try {
    const fileName = getDownloadFileName(downloadUrl);
    pythonPath = await tc.downloadTool(downloadUrl, fileName, AUTH);
    core.info('Extract downloaded archive');
    let pythonExtractedFolder;
    if (IS_WINDOWS) {
      pythonExtractedFolder = await tc.extractZip(pythonPath);
    } else {
      pythonExtractedFolder = await tc.extractTar(pythonPath);
    }

    core.info('Execute installation script');
    await installPython(pythonExtractedFolder);
  } catch (err) {
    if (err instanceof tc.HTTPError) {
      // Rate limit?
      if (err.httpStatusCode === 403 || err.httpStatusCode === 429) {
        core.info(
          `Received HTTP status code ${err.httpStatusCode}.  This usually indicates the rate limit has been exceeded`
        );
      } else {
        core.info(err.message);
      }
      if (err.stack) {
        core.debug(err.stack);
      }
    }
    throw err;
  }
}
